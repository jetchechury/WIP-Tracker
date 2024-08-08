import config as c # type: ignore

import mysql.connector
from mysql.connector import Error
import sshtunnel

import pandas as pd

import pytz
from datetime import datetime, timedelta

from flask import Flask, render_template, jsonify, request, redirect, url_for, session,send_from_directory

# import warnings
# warnings.filterwarnings("ignore")


app = Flask(__name__)

tunnel = sshtunnel.SSHTunnelForwarder(
            (c.ssh_host),
            ssh_username=c.sshUsername, ssh_password=c.sshPassword,
            remote_bind_address=c.remoteBindAddress
            )
tunnel.start()

def accessDatabase(queryStatement=None, updateStatement=None, insertTup=None):
    # try:
    connection = mysql.connector.connect(
        host = c.host,
        database = c.database,
        user = c.user,
        password = c.password,
        port=tunnel.local_bind_port,
        use_pure=True,
    )
    
    if connection and connection.is_connected():
        cursor = connection.cursor()   

        if insertTup:
            inserStatement = insertTup[0]     
            insertData = insertTup[1] 

            cursor.executemany(inserStatement, insertData)
            connection.commit()
            print('Data inserted')


        if updateStatement:
            cursor.execute(updateStatement)
            connection.commit()

        if queryStatement:
            cursor.execute(queryStatement)
            columnNames = cursor.description
            data = [{columnNames[index][0]: col for index, col in enumerate(value)} for value in cursor.fetchall()]
            if len(data) == 0:
                listofCols = [col[0] for col in columnNames]
                df = pd.DataFrame(columns=listofCols)
            else:
                df = pd.DataFrame(data)
        completed = True
    else:
        pass
        
    # except Error as e:
    #     print("Error while connecting to MySQL", e)
    # finally:
    #     try:
    #         if connection.is_connected():
    #             cursor.close()
    #             connection.close()
    #     except:
    #         pass
            
    if queryStatement:
        return df

projectsQuery = """
 SELECT p.*
,cte.elapsedTime
,cte.mostRecentStart
,cte.mostRecentEnd
FROM Projects p
LEFT JOIN(SELECT projectID
,SUM(TIMESTAMPDIFF(SECOND, sessionStart, sessionEnd)) as elapsedTime 
,MAX(sessionStart) as mostRecentStart 
,MAX(sessionEnd) as mostRecentEnd FROM Sessions GROUP BY projectID) cte on cte.projectID = p.projectID

"""
timeStampCols = ['mostRecentStart','mostRecentEnd','projectStartDatetime','projectEndDatetime','sessionStart','sessionEnd','Last Session']

def sessionsTable(projectID):
    querySession = f"""
    SELECT *, TIMESTAMPDIFF(SECOND, sessionStart, sessionEnd) as Time 
    ,CAST(SUBSTRING_INDEX(sessionID,'-',-1) AS UNSIGNED) AS sortValue
    FROM Sessions 
    WHERE projectID ={projectID}

    ORDER BY projectID, sortValue desc
    """
    sessions = accessDatabase(queryStatement=querySession)
    sessions = updateTimeCols(sessions)
    sessions=dtColtoStr(sessions)

    sessions2 = sessions[['sessionID','sessionStart','sessionEnd', 'Time']]
    sessions2.rename(columns={'sessionID':'ID','sessionStart':'Start','sessionEnd':'End'},inplace=True)

    return sessions2

def rowCounterTable(projectID, rowCounterID=None):
    queryRowCt = f"""
    SELECT c.projectID, c.rowCounterID, c.name, c.startingRow,
    r2.rowNumber, r2.stitchType, r2.timestamp
    FROM RowCounters c
    LEFT JOIN( SELECT  r.rowCounterID, r.rowNumber, r.stitchType, r.timestamp
    FROM RowDetail r
    JOIN (
        SELECT rowCounterID, MAX(timestamp) AS maxTimestamp
        FROM RowDetail
        GROUP BY rowCounterID
    ) AS maxRows
    ON r.rowCounterID = maxRows.rowCounterID AND r.timestamp = maxRows.maxTimestamp) AS r2
    ON c.rowCounterID = r2.rowCounterID
    WHERE c.projectID ={projectID} 
    """

    if rowCounterID:
        queryRowCt += f"""AND c.rowCounterID = {rowCounterID} """

    rowCts = accessDatabase(queryStatement=queryRowCt)
    rowCts = updateTimeCols(rowCts)
    rowCts=dtColtoStr(rowCts)

    return rowCts

def updateTimeCols(df):
    
    for col in timeStampCols:
        try:
            df[col] = df[col].dt.tz_localize('UTC')
            df[col] = df[col].dt.tz_convert('US/Central')
        except:
            pass
    return df

def dtColtoStr(df):
    for col in timeStampCols:
        try:
            df[col] = df[col].dt.strftime('%m/%d/%y %I:%M:%S %p')
        except:
            pass
    # try:
    #     df['elapsedTime'] = pd.to_datetime(df["elapsedTime"], unit='s').dt.strftime("%H H %M M %S S")
    # except:
    #     pass
    return df

def convert_seconds(seconds):
    if pd.isna(seconds):
        return ''
    
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if days > 0:
        parts.append(f"{days} D")
    if hours > 0:
        parts.append(f"{hours} H")
    if minutes > 0:
        parts.append(f"{minutes} M")
    if secs > 0 or not parts:
        parts.append(f"{secs} S")
    
    return ' '.join(parts)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    print(session)
    if username and password:
        return jsonify({'success':True})
    # if user:
    #     session['user_id'] = user['userID']
    #     return jsonify({'success': True})
    else:
        return jsonify({'success': False})

@app.route('/')
def home():
    # if 'user_id' in session:
    df = accessDatabase(queryStatement=projectsQuery + "WHERE p.active = 1")
    
    df['Last Session'] = df[['mostRecentStart', 'mostRecentEnd']].max(axis=1)
    
    df=updateTimeCols(df)
    df=dtColtoStr(df)

    df2 = df.rename(columns={'projectID':'Project ID','projectName':'Name',
                        'projectDescription': 'Description', 'projectStartDatetime':'Start',
                        'projectEndDatetime': 'End', 'running':'Timer Status', 'elapsedTime':'Total Time'})

    df3 = df2[['Project ID',
    'Name',
    'Description',
    'Start',
    'End',
    'Total Time',
    'Timer Status',
    'Last Session']]

    df3.fillna('',inplace=True)

    # df3.loc[df3['Timer Status']==0,'Timer Status']='OFF'
    # df3.loc[df3['Timer Status']==1,'Timer Status']='ON'
    df3['Last Session'] = df3['Last Session'].astype(str).replace('NaT','')

    unfinishedProjs_df = df3.loc[df3['End']=='']
    unfinishedProjs = unfinishedProjs_df.to_dict(orient='records')

    finishedProjs_df = df3.loc[df3['End']!='']
    finishedProjs = finishedProjs_df.to_dict(orient='records')
    return render_template('home.html', projects1=unfinishedProjs, projects2=finishedProjs)

    # else:
    #     return redirect(url_for('login'))

# @app.route('/')
# def login_page():
#     # return app.send_static_file('login.html')

#     return render_template('login.html')

@app.route('/project/newProjectCreate', methods=['POST'])
def createNewProj():
    
    data = request.get_json()
    userID = data.get('userID')
    projName = data.get('projName')
    projDesc = data.get('projDesc')

    print(userID,projName,projDesc)
    try:
        nextProjID = int(accessDatabase(queryStatement='SELECT projectID FROM Projects ORDER BY projectID desc LIMIT 1' ).iloc[0]['projectID']) + 1
    except:
        nextProjID = 1

    print(nextProjID)

    insertNewProj = """ INSERT INTO Projects
    (projectID,userID,projectName,projectDescription,active)
    VALUES (%s,%s,%s,%s,%s)"""

    insertNewProjData = [(nextProjID, userID, projName, projDesc,True)]
    accessDatabase(insertTup=tuple((insertNewProj,insertNewProjData)))

    print(data)

    projectInfoQuery = projectsQuery + f"WHERE p.projectID = {nextProjID}"   

    project = accessDatabase(queryStatement=projectInfoQuery)
    project = updateTimeCols(project)
    project=dtColtoStr(project)

    if not project.empty:
        project.loc[project['projectStartDatetime'].isnull(),['projectEndDatetime','projectStartDatetime']] = 'Not Started'
        project_data = project.iloc[0].to_dict()

        print(project_data)
        sessionsData = sessionsTable(nextProjID).to_dict(orient='records')
        print(sessionsData)


        return jsonify(success=True, projectID=nextProjID)


@app.route('/project/<int:projectID>')
def project_detail(projectID):
    # Fetch project details from the database
    projectInfoQuery = projectsQuery + f"WHERE p.projectID = {projectID}"   

    project = accessDatabase(queryStatement=projectInfoQuery)
    project = updateTimeCols(project)
    project=dtColtoStr(project)


    if project.empty:
        return "Project not found", 404
    
    project.loc[project['projectEndDatetime'].isnull(),'projectEndDatetime'] = 'In Progress'
    project_data = project.iloc[0].to_dict()
    
    session_df = sessionsTable(projectID)
    if session_df.empty:
        sessionsData = session_df.columns.tolist()
        sessionsPres='N'
    else:
        sessionsData = session_df.to_dict(orient='records')
        sessionsPres='Y'


    rowCounters = rowCounterTable(projectID)
    rowCounters.sort_values(by=['rowCounterID'], inplace=True)
    rowCounters.loc[rowCounters['rowNumber'].isnull(), 'rowNumber'] = rowCounters['startingRow']
    rowCounters['currentRow'] = rowCounters['rowNumber'].astype(int) + 1
    rowCounters.loc[rowCounters['stitchType'].isnull(), 'stitchType'] = ''
    rowCountersData = rowCounters.to_dict(orient='records')
    print(rowCountersData)

    return render_template('project_detail.html', project=project_data, session=sessionsData,sessionsPres=sessionsPres, rowCtrs = rowCountersData, stitches=stitchTypeList)
    

@app.route('/project/<int:projectID>/session/<sessionID>')
def sessionDetail(sessionID, projectID):

    print(sessionID)
     # Fetch project details from the database
    projectInfoQuery = projectsQuery + f"WHERE p.projectID = {projectID}"   

    project = accessDatabase(queryStatement=projectInfoQuery)
    project = updateTimeCols(project)
    project=dtColtoStr(project)

    sessions = accessDatabase(queryStatement=f"""SELECT *, TIMESTAMPDIFF(SECOND, sessionStart, sessionEnd) as elapsedTime FROM Sessions WHERE sessionID ='{sessionID}' """)
    sessions = updateTimeCols(sessions)
    sessions=dtColtoStr(sessions)

    print(sessions)

    if not project.empty:
        project.loc[project['projectEndDatetime'].isnull(),'projectEndDatetime'] = 'In Progress'
        project_data = project.iloc[0].to_dict()

        sessions2 = sessions[['sessionID','sessionStart','sessionEnd', 'elapsedTime']]
        sessions2.rename(columns={'sessionID':'ID','sessionStart':'Start','sessionEnd':'End'},inplace=True)

        sessionsData = sessions2.iloc[0].to_dict()
        print(sessionsData)

        return render_template('session_detail.html', project=project_data, session=sessionsData)
    return "Project not found", 404

@app.route('/project/<int:project_id>/start_timer', methods=['POST'])
def start_timer(project_id):
    data = request.get_json()
    startTime = data.get('startTime')
    startTime2 = pd.Timestamp(startTime)

    project = accessDatabase(f"SELECT projectStartDatetime FROM Projects WHERE projectID = {project_id}")
     # Fetch session data
    session = accessDatabase(queryStatement=f"SELECT * FROM Sessions WHERE projectID = {project_id} ORDER BY sessionStart desc")        

    if not project.empty:
        # Create Session
        if session.empty:
            newSessionID = f"{project_id}-1"
        else:
            newSessionID = f"{project_id}-{int(session['sessionID'].iloc[0].split('-')[-1]) + 1}"

        insertToSessions = """INSERT INTO Sessions
        (sessionID, sessionStart, sessionEnd, projectID) 
        VALUES (%s,%s,%s,%s)"""

        insertToSessionsData = [(newSessionID, str(startTime2), None, project_id)]
        accessDatabase(insertTup=tuple((insertToSessions,insertToSessionsData)))
        
        projStart = project['projectStartDatetime'].iloc[0]
        update_query = "UPDATE Projects SET running = TRUE"
        
        if pd.isna(projStart):
            update_query += ", projectStartDatetime = UTC_TIMESTAMP()"
        
        update_query += f" WHERE projectID = {project_id}"
            
        updated_project = accessDatabase(updateStatement=update_query, queryStatement=projectsQuery + f" WHERE p.projectID = {project_id}")
        updated_project = updateTimeCols(updated_project)
        updated_project= dtColtoStr(updated_project)
        updated_project.fillna(0, inplace=True)

        project_data = updated_project.iloc[0].to_dict()

        # print(project_data)
        # projStart = project['projectStartDatetime'].iloc[0].isoformat()

        # print(project_data)
        return jsonify({"status": "success", "project": project_data, "sessionID":newSessionID}), 200

        # return jsonify({"status": "success", "startTime": projStart}), 200
    
    return jsonify({"status": "error", "message": "Project not found"}), 404


@app.route('/project/<int:projectID>/stop_timer', methods=['POST'])
def stop_timer(projectID):
    data = request.get_json()
    currentElapsedTime = data.get('currentElapsedTime')
    stopTime = data.get('stopTime')
    startTime = data.get('startTime')
    sessionID = data.get('sessionID')

    # Convert stop_time from string to Timestamp
    stopTime2 = pd.Timestamp(stopTime)
    startTime2 = pd.Timestamp(startTime)

    # Fetch project data
    updateSessions = f"""
    UPDATE Sessions
    SET sessionEnd = '{str(stopTime2)}'
    WHERE sessionID = '{sessionID}'
    """

    querySessions = f"SELECT * FROM Sessions WHERE sessionID = '{sessionID}' "
    
    sessionInfo = accessDatabase(updateStatement=updateSessions, queryStatement=querySessions)
    print(sessionInfo)

    # Fetch session data
    if not sessionInfo.empty:
    
        project_data = sessionInfo.iloc[0]

        print(startTime2)
        print(stopTime2)
      
        timediff = (stopTime2 - startTime2).total_seconds()
        print(timediff)
        print(currentElapsedTime)

        updateProjects = f"""
        UPDATE Projects
        SET running = FALSE
        WHERE projectID = '{projectID}'
        """

        projectInfoQuery = projectsQuery + f"WHERE p.projectID = {projectID}" 
    
        updated_project = accessDatabase(updateStatement=updateProjects, queryStatement=projectInfoQuery)
        updated_project = updateTimeCols(updated_project)
        updated_project= dtColtoStr(updated_project)

        project_data = updated_project.iloc[0].to_dict()

        sessions_df = sessionsTable(projectID)
        sessions_df.fillna({'End': -1, 'Time': -1}, inplace=True)
        sessionsData = sessions_df.to_dict(orient='records')

        print(sessionsData)
  

        return jsonify({"status": "success", "project": project_data, "session":sessionsData}), 200
    
    return jsonify({"status": "error", "message": "Project not found"}), 404

@app.route('/project/<int:projectID>/updateElapsedTime', methods=['POST'])
def updateElapsedTime(projectID):
    data = request.get_json()
    stopTime = data.get('stopTime')
    sessStart = data.get('sessStart')
    postType = data.get('postType')
    sessionID = data.get('sessionID')

    stopTime2 = pd.Timestamp(stopTime)
    sessStart2 = pd.Timestamp(sessStart)

    # Convert stop_time from string to Timestamp
    # stop_time = pd.Timestamp(stopTime2).tz_convert('US/Central')
    # try:
    if postType == 'activeTimer':
        update_query = f"""
            UPDATE Sessions
            SET sessionEnd = '{str(stopTime2)}'
            WHERE projectID = {projectID} and sessionStart = '{str(sessStart2)}'
            """
        
        update_query2 = f"""
            UPDATE Projects
            SET running = FALSE
            WHERE projectID = {projectID}
            """
            
        accessDatabase(updateStatement=update_query2)
    if postType == 'updateSession':
        update_query = f"""
            UPDATE Sessions
            SET sessionEnd = '{str(stopTime2)}'
            ,sessionStart = '{str(sessStart2)}'
            WHERE projectID = {projectID} and sessionID = '{sessionID}'
            """
        print(update_query)
    updated_project = accessDatabase(updateStatement=update_query, queryStatement=projectsQuery + f"WHERE p.projectID = {projectID}")

    updated_project = updateTimeCols(updated_project)
    updated_project= dtColtoStr(updated_project)

    project_data = updated_project.iloc[0].to_dict()
    
    sessions_df = sessionsTable(projectID)
    sessions_df.fillna({'End': -1, 'Time': -1}, inplace=True)

    if postType == 'updateSession':
        sessions_df2 = sessions_df.loc[sessions_df['ID']==sessionID]
        sessionsData = sessions_df.iloc[0].to_dict()
    else:
        sessionsData = sessions_df.to_dict(orient='records')

    return jsonify({"status": "success", "project": project_data, "session":sessionsData}), 200
    # except:
    #     return jsonify({"status": "error", "message": "Project not found"}), 404


@app.route('/project/<int:projectID>/get_timer', methods=['GET'])
def get_timer(projectID):
    project = accessDatabase(queryStatement=projectsQuery + f"WHERE p.projectID = {projectID}")
    if not project.empty:
        project_data = project.iloc[0].to_dict()
        print(project_data)
        return jsonify({"status":"success", "project" :project_data}), 200
    return jsonify({"status": "error", "message": "Project not found"}), 404


@app.route('/project/<int:projectID>/markProjComplete', methods=['POST'])
def compProj(projectID):
    data = request.get_json()
    projEnd = data.get('projEnd')

    projEnd2 = pd.Timestamp(projEnd)

    updStatement = f""" UPDATE Projects
                    SET projectEndDatetime = '{str(projEnd2)}'
                    WHERE projectID = {projectID} """
    
    updated_project = accessDatabase(updateStatement=updStatement, queryStatement=projectsQuery + f" WHERE p.projectID = {projectID}")
    updated_project = updateTimeCols(updated_project)
    updated_project= dtColtoStr(updated_project)
    updated_project.fillna(0, inplace=True)

    project_data = updated_project.iloc[0].to_dict()
    return jsonify({"status":"success", "project" :project_data}), 200


    # return jsonify({"status": "error", "message": "Project not found"}), 404

@app.route('/project/<int:projectID>/markProjInactive', methods=['POST'])
def delProj(projectID):
    data = request.get_json()
    projEnd = data.get('projEnd')

    projEnd2 = pd.Timestamp(projEnd)

    updStatement = f""" UPDATE Projects
                    SET projectEndDatetime = '{str(projEnd2)}',
                    active = 0
                    WHERE projectID = {projectID} """
    
    updated_project = accessDatabase(updateStatement=updStatement, queryStatement=projectsQuery + f" WHERE p.projectID = {projectID}")
    updated_project = updateTimeCols(updated_project)
    updated_project= dtColtoStr(updated_project)
    updated_project.fillna(0, inplace=True)

    project_data = updated_project.iloc[0].to_dict()
    return jsonify({"status":"success", "project" :project_data}), 200

@app.route('/counter/add', methods=['POST'])
def add_counter():
    data = request.get_json()
    counter_name = data.get('counterName')
    starting_row = data.get('startingRow')
    projectID = data.get('projectID')
    try:
        nextrowCtID = int(accessDatabase(queryStatement='SELECT rowCounterID FROM RowCounters ORDER BY rowCounterID desc LIMIT 1' ).iloc[0]['rowCounterID']) + 1
    except:
        nextrowCtID = 1

    # Insert the data into the database
    insert_counter = """INSERT INTO RowCounters (projectID, rowCounterID, name, startingRow) VALUES (%s,%s,%s, %s)"""
    insert_counter_data = [(projectID,nextrowCtID, counter_name,starting_row)]
    accessDatabase(insertTup=(insert_counter, insert_counter_data))

    return jsonify(success=True)


@app.route('/counter/update', methods=['POST'])
def update_counter():
    data = request.get_json()

    counterVal = data.get('value')
    eventTime = data.get('timestamp')
    rowCtID = data.get('rowCtID')
    counterNotes = data.get('counterNotes')
    stitchType = data.get('stitchType')
    sessionID = data.get('sessionID')

    eventTime2 = pd.Timestamp(eventTime)

    # Insert the new value into the database
    update_counter_query = """INSERT INTO RowDetail (rowCounterID, sessionID, rowNumber, stitchType, notes, timestamp) VALUES (%s,%s,%s,%s,%s,%s)"""
    update_counter_data = [(rowCtID, sessionID, counterVal, stitchType, counterNotes, str(eventTime2))]
    accessDatabase(insertTup=(update_counter_query, update_counter_data))

    return jsonify(success=True)

stitchTypeList = ["Back Post Double Crochet"
             ,"Back Post Half Double Crochet"
             ,"Back Post Single Crochet"
             ,"Back Post Triple Crochet"
             ,"Back Stitch"
             ,"Chain"
             ,"Chain Space"
             ,"Cluster"
             ,"Crossed Double Crochet"
             ,"Double Crochet"
             ,"Double Crochet 2 Together"
             ,"Double Crochet 3 Together"
             ,"Double Crochet 4 Together"
             ,"Double Crochet 5 Together"
             ,"Double Crochet Cluster"
             ,"Extended Double Crochet"
             ,"Extended Half Double Crochet"
             ,"Extended Single Crochet"
             ,"Extended Triple Crochet"
             ,"Foundation Double Crochet"
             ,"Foundation Half Double Crochet"
             ,"Foundation Single Crochet"
             ,"Foundation Triple Crochet"
             ,"Front Post Double Crochet"
             ,"Front Post Half Double Crochet"
             ,"Front Post Single Crochet"
             ,"Front Post Triple Crochet"
             ,"Half Double Crochet"
             ,"Half Double Crochet 2 Together"
             ,"Half Double Crochet 3 Together"
             ,"Invisible Decrease"
             ,"Long Single Crochet"
             ,"Magic Circle"
             ,"Picot"
             ,"Purl"
             ,"Reverse Single Crochet"
             ,"Shell"
             ,"Single Crochet"
             ,"Single Crochet 2 Together"
             ,"Single Crochet 3 Together"
             ,"Slip Stitch"
             ,"Treble Crochet"
             ,"Triple Crochet"
             ,"Triple Crochet 2 Together"
             ,"Triple Crochet 3 Together"
             ,"V Stitch"]

if __name__ == '__main__':
    app.run(debug=True)
