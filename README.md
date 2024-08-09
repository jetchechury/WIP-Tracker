# WIP-Tracker
Works in progress tracker for fiber artists and enthusiasts 

## Objective
This project aims to assist fiber artists and enthusiasts in tracking both time spent and current row progress on their projects.

## Database
To support the UI and store incoming data, a MySQL database was designed and implemented. Prior to construction, a thorough list of required data was drafted, and a schema diagram was created to ensure clear relationships and prevent data duplication in the tables.

## Endpoints
The WIP Tracker was built using a Flask application with the following endpoints:

* `/` - Queries the database to render the homepage, which displays active and completed projects and allows users to add new projects.
* `/project/newProjectCreate` - Inserts new project data into the database and returns a JSON object with the associated project ID.
* `/project/<projectID>` - Queries the database to render the project detail page, showing information, a timer, and row counters for the selected project.
* `/project/<projectID>/session/<sessionID>` - Queries the database to render the session detail page, displaying project and session details, and allowing users to edit the session.
* `/project/<project_id>/start_timer` - Determines the next session ID, writes timer status, start time, and session data to the database, and returns a JSON object with updated project data and the new session ID.
* `/project/<projectID>/stop_timer` - Updates session data and timer status in the database, returning a JSON object with updated project and session information.
* `/project/<projectID>/updateElapsedTime` - Updates session data and timer status based on the request type, returning a JSON object with updated project and session details.
* `/project/<projectID>/markProjComplete` - Updates the project’s end date and returns a JSON object with the updated project data.
* `/project/<projectID>/markProjInactive` - Sets the project’s active status to 0, returning a JSON object with the updated project data.
* `/counter/add` - Determines the next row counter ID, then inserts a new row counter record based on user input.
* `/counter/update` - Inserts a new record into the row detail table.

## Application Features
This application is designed to offer users the flexibility to track their progress in a way that best suits their needs.

* Users can create new projects as needed.
* The homepage provides an overview of all active and completed projects.
* The project detail page offers comprehensive information on the time dedicated to each project, including a session table that displays the start time, end time, and duration of every session.
* Users can edit the start and end dates of any session by selecting the session ID.
* An unlimited number of row counters can be added to each project, allowing users to track different parts or sections separately. Each row counter can also capture details such as stitch type and notes.

## Future Explorations
The following features are proposed to enhance the WIP Tracker:

* Implement user metrics for each project, including but not limited to:
    * A bar chart illustrating daily time spent on a project
    * Average time spent on each row for row counters and/or projects
    * A pie chart showing time allocation across different project components
    * An estimated completion date based on historical data
* Generate patterns from information collected via row counters
* Utilize AI to analyze uploaded patterns and generate new projects and row counters based on the insights
* Employ AI to automatically populate row counter notes based on historical entries
* Apply data from previous projects to assist users in creating timelines for new projects by estimating time requirements based on similar past activities








