let timerInterval;
let localElapsedTime = 0; // Local elapsed time in seconds
let isRunning = false; // To track the state of the timer
let startTime = null;
let endTime = null
let sessionID = null

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatTime2(seconds) {
    const months = Math.floor(seconds / (30 * 24 * 3600)); // Approximate month duration as 30 days
    const weeks = Math.floor((seconds % (30 * 24 * 3600)) / (7 * 24 * 3600));
    const days = Math.floor((seconds % (7 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    // Create an array to hold the parts of the time string
    const timeParts = [];

    if (months > 0) timeParts.push(`${months < 10 ? '0' : ''}${months}M`);
    if (weeks > 0) timeParts.push(`${weeks < 10 ? '0' : ''}${weeks}W`);
    if (days > 0) timeParts.push(`${days < 10 ? '0' : ''}${days}D`);
    if (hours > 0) timeParts.push(`${hours < 10 ? '0' : ''}${hours}H`);
    if (minutes > 0) timeParts.push(`${minutes < 10 ? '0' : ''}${minutes}M`);
    if (secs > 0 || timeParts.length === 0) timeParts.push(`${secs < 10 ? '0' : ''}${secs}S`);

    // Join the time parts with a space and return
    return timeParts.join(' ');
}



function toggleTimer() {
    const projectID = document.getElementById('toggleButton').getAttribute('data-project-id');
    console.log('Project ID:', projectID);
    if (isRunning) {
        stopTimer(projectID);
    } else {
        startTimer(projectID);
    }
}
function updateTimer() {
    if (isRunning && startTime !== null) {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000; // Convert milliseconds to seconds
        const totalElapsedTime = localElapsedTime + elapsed;
        document.getElementById('timer').innerText = formatTime(totalElapsedTime);
    }
}

function startTimer(projectID) {
    document.getElementById('toggleButton').style.visibility = 'hidden'
    // document.getElementById('completeProject').style.visibility = 'hidden'
    // document.getElementById('addcounter').style.visibility = 'hidden'
    // document.getElementById('toggleButton').innerText = 'Starting Timer';
    startTime = Date.now();
    fetch(`/project/${projectID}/start_timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            startTime: new Date(startTime) // Send startTime to the server
        })
    }).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
        .then(data => {
            if (data.status === 'success') {
                console.log('Timer Started')
                isRunning = true;
                sessionID = data.sessionID
                // startTime = Date.now();
                document.getElementById('timer').innerText = formatTime(localElapsedTime);
                document.getElementById('toggleButton').innerText = 'Stop';
                document.getElementById('toggleButton').style.visibility = 'visible'
                document.getElementById('sessionID').innerText = sessionID;
                timerInterval = setInterval(updateTimer, 1000); // Update every 1000 milliseconds (1 second)
                document.getElementById('lastAction').innerText = formatDate(new Date(startTime))
                const runningElem = document.getElementById('running')
                runningElem.innerText = data.project.running
                runningElem.setAttribute('data-onoff', data.project.running);

            }
        });
}

function stopTimer(projectID) {
    document.getElementById('toggleButton').style.visibility = 'hidden'
    if (isRunning && startTime !== null) {
        endTime = Date.now()
        const elapsed = (endTime - startTime) / 1000; // Convert milliseconds to seconds
        localElapsedTime += elapsed; // Add the elapsed time to the local elapsed time
    }
    console.log(sessionID)
    clearInterval(timerInterval);

    fetch(`/project/${projectID}/stop_timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            currentElapsedTime: localElapsedTime,
            stopTime: new Date(endTime),
            startTime: new Date(startTime),
            sessionID: sessionID
        })
    }).then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                isRunning = false;
                localElapsedTime = 0; // Reset the local elapsed time
                document.getElementById('timer').innerText = formatTime(localElapsedTime);
                document.getElementById('toggleButton').innerText = 'Start';
                document.getElementById('toggleButton').style.visibility = 'visible'
                // document.getElementById('completeProject').style.visibility = 'visible'
                // document.getElementById('addcounter').style.visibility = 'visible'
                document.getElementById('sessionID').innerText = '';
                document.getElementById('lastAction').innerText = formatDate(new Date(endTime))
                updateProjectDetails(data.project);
                updateSessionTable(data.session, projectID);
                const runningElem = document.getElementById('running')
                runningElem.innerText = data.project.running
                runningElem.setAttribute('data-onoff', data.project.running);

            }
        });
}


function updateProjectDetails(project) {
    // Update the specific columns in the table
    const fieldsToUpdate = ['projectStartDatetime', 'projectEndDatetime', 'elapsedTime', 'mostRecentStart', 'mostRecentEnd', 'running'];
    fieldsToUpdate.forEach(field => {
        if (document.getElementById(field)) {
            if (field == 'elapsedTime') {
                document.getElementById(field).innerText = formatTime2(project[field]);
            }
            else if (field == 'projectEndDatetime' && project[field] == null) {
                document.getElementById(field).innerText = 'In Progress';
            }
            else {
                document.getElementById(field).innerText = project[field];
            }
        }
    });
}

function updateSessionTable(sessions, projectID) {
    const tableBody = document.getElementById('sessionTableBody');
    tableBody.innerHTML = ''; // Clear the current table content

    sessions.forEach(session => {
        const row = document.createElement('tr');

        const sessionIDCell = document.createElement('td');
        const sessionIDLink = document.createElement('a');
        sessionIDLink.href = `/project/${projectID}/session/${session.ID}`;
        sessionIDLink.innerText = session.ID;
        sessionIDCell.appendChild(sessionIDLink);
        row.appendChild(sessionIDCell);


        const startTimeCell = document.createElement('td');
        if (session.Start == -1) {
            startTimeCell.innerText = 'NaN';
        }
        else {
            startTimeCell.innerText = new Date(session.Start).toLocaleString();
        };
        row.appendChild(startTimeCell);

        const stopTimeCell = document.createElement('td');
        if (session.End == -1) {
            stopTimeCell.innerText = 'Unavailable';
        }
        else {
            stopTimeCell.innerText = new Date(session.End).toLocaleString();
        }
        row.appendChild(stopTimeCell);

        const elapsedTimeCell = document.createElement('td');
        if (session.Time == -1) {
            elapsedTimeCell.innerText = 'Unavailable';
        }
        else {
            elapsedTimeCell.innerText = formatTime2(session.Time);
        }
        elapsedTimeCell.classList.add('elapsedTime');
        elapsedTimeCell.setAttribute('data-seconds', session.Time);
        row.appendChild(elapsedTimeCell);
        tableBody.appendChild(row);
    });
}

let sendStop = null
let sendStart = null
let sendElap = 0
function promptUserForElapsedTime(projectID) {
    fetch((`/project/${projectID}/get_timer`), { method: 'GET' })
        .then(response => {// Check if the response is okay (status in the range 200-299)
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            // Parse the response body as JSON
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                mostRecent = new Date(data.project['mostRecentStart'])
                const currElapsed = parseFloat(data.project.elapsedTime)
                const currElapsedStr = formatTime2(currElapsed)
                const currentTime = new Date();
                const pendingElapsed = (currentTime - mostRecent) / 1000
                const elapsedTimeStr = formatTime2(pendingElapsed)
                newElapsed = currElapsed + pendingElapsed

                const useElapsedTime = confirm("The timer for this project is currently running.  Would you like to add the elapsed time " + elapsedTimeStr + " to the total time (" + currElapsedStr + ")?  The new total would be " + formatTime2(newElapsed));
                if (useElapsedTime) {
                    sendStop = currentTime
                    sendStart = mostRecent
                    sendElap = newElapsed
                }
                else {
                    sendStop = mostRecent
                    sendStart = mostRecent

                };

                fetch(`/project/${projectID}/updateElapsedTime`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stopTime: sendStop,
                        sessStart: sendStart,
                        postType: 'activeTimer'
                    })
                }).then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            window.location.reload();

                        }
                    });
            }
        })
};


function updateSession() {
    const updbtnelm = document.getElementById('updateSession')
    const projectID = updbtnelm.getAttribute('data-project-id');
    const sessionID = updbtnelm.getAttribute('data-session-id');
    const newStart = document.getElementById('startTime').value.replace('T', ' ')
    const newEnd = document.getElementById('endTime').value.replace('T', ' ')

    fetch(`/project/${projectID}/updateElapsedTime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            stopTime: new Date(newEnd),
            sessStart: new Date(newStart),
            postType: 'updateSession',
            sessionID: sessionID
        })
    }).then(response => response.json())
        .then(data => {
            if (data.status === 'success') {

                document.getElementById('session-start').innerText = data.session['Start']
                document.getElementById('session-end').innerText = data.session['End']
                document.getElementById('elapsedTime').innerText = formatTime2(data.project['elapsedTime'])
                // isRunning = false;
                // localElapsedTime = 0; // Reset the local elapsed time
                // document.getElementById('timer').innerText = formatTime(localElapsedTime);
                // document.getElementById('toggleButton').innerText = 'Start';
                // updateProjectDetails(data.project);
                // updateSessionTable(data.session,projectID);
            }
        });
};


function completeProject() {
    const endTime = new Date();
    document.getElementById('toggleButton').style.visibility = 'hidden'
    const compbtnelm = document.getElementById('completeProject');
    const projectID = compbtnelm.getAttribute('data-project-id');

    fetch(`/project/${projectID}/markProjComplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projEnd: endTime
        })
    }).then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.reload();
                // updateProjectDetails(data.project);
                // compbtnelm.style.visibility = 'hidden'
            }
        });
};

function deleteProject() {
    const endTime = new Date();
    document.getElementById('toggleButton').style.visibility = 'hidden'
    const compbtnelm = document.getElementById('deleteProject');
    const projectID = compbtnelm.getAttribute('data-project-id');

    fetch(`/project/${projectID}/markProjInactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projEnd: endTime
        })
    }).then(response => response.json())
        .then(data => {
            if (data.status === 'success') {

                alert('Project deleted successfully!');
                window.location.href = '/';
            }
        });
};

document.addEventListener("DOMContentLoaded", (event) => {
    const runningElement = document.getElementById('running');
    const toggleButtonElement = document.getElementById('toggleButton');

    if (runningElement && toggleButtonElement) {
        const runStat = runningElement.innerText;
        const projectID = toggleButtonElement.getAttribute('data-project-id');

        if (runStat == 1 && projectID) {
            promptUserForElapsedTime(projectID);
        }
    }
});

function timerOnOff() {
    const onoffCell = document.querySelectorAll('.timerStat');
    onoffCell.forEach(cell => {
        const stat = parseInt(cell.getAttribute('data-onoff'), 10);
        if (stat == 0) {
            cell.textContent = 'OFF';
        } else {
            cell.textContent = 'ON';
        }
    });
}
document.addEventListener('DOMContentLoaded', function () {
    const elapsedTimeCells = document.querySelectorAll('.elapsedTime');
    elapsedTimeCells.forEach(cell => {
        const seconds = parseInt(cell.getAttribute('data-seconds'), 10);
        if (!isNaN(seconds)) {
            cell.textContent = formatTime2(seconds);
        } else {
            cell.textContent = 'Unavailable';
        }
    });


    // timerOnOff()

});

document.addEventListener("DOMContentLoaded", function () {
    const datetimeLocalInputs = document.querySelectorAll('input[type="datetime-local"]');

    if (datetimeLocalInputs) {
        datetimeLocalInputs.forEach(cell => {
            const startTime = cell.getAttribute('default-val');


            const now = new Date(startTime);
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');


            const defaultValue = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            cell.setAttribute('value', defaultValue)
            // document.getElementById('datetime').value = defaultValue;


        })
    };

    function calculateDuration() {

        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const durationElement = document.getElementById('calculatedDuration');

        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const duration = (end - start) / 1000; // duration in seconds

            if (duration >= 0) {
                durationElement.textContent = formatTime2(duration);
            } else {
                durationElement.textContent = 'End time must be after start time';
            }
        } else {
            durationElement.textContent = '';
        }
    }

    const startTimeElem = document.getElementById('startTime');
    const endTimeElem = document.getElementById('endTime');
    const durationElement = document.getElementById('calculatedDuration');

    if (startTimeElem && endTimeElem && durationElement) {
        document.getElementById('startTime').addEventListener('change', calculateDuration);
        document.getElementById('endTime').addEventListener('change', calculateDuration);
    };
});

document.addEventListener('DOMContentLoaded', function () {
    const togbutton = document.getElementById('toggleButton');
    const completeBtn = document.getElementById('completeProject');

    if (togbutton && completeBtn) {
        const completionDate = togbutton.getAttribute('data-completion-date');

        if (completionDate == "In Progress") {
            togbutton.style.display = 'inline'; // Show the button
            completeBtn.style.display = 'inline'; // Show the button
        } else {
            togbutton.style.display = 'none'; // Hide the button
            completeBtn.style.display = 'none'; // Hide the button
        }
    }

});


function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr
    }
    const dateOptions = {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
    };
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);
    const timeFormatter = new Intl.DateTimeFormat('en-US', timeOptions);

    const formattedDate = dateFormatter.format(date);
    const formattedTime = timeFormatter.format(date);

    return `${formattedDate} ${formattedTime}`;
};

// function formatDatetimeElements() {
//     const elements = document.querySelectorAll('.datetime');
//     elements.forEach(element => {
//         const dateStr = element.getAttribute('data-date');
//         if (dateStr) {
//             const formattedDate = formatDate(dateStr);
//             element.textContent = formattedDate;
//         }
//     });
// }

// // Run the function when the DOM is fully loaded
// document.addEventListener('DOMContentLoaded', formatDatetimeElements);


document.addEventListener('DOMContentLoaded', function () {
    timerOnOff()

});
// Function to handle mutations
function handleMutations(mutationsList) {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') { }
        else if (mutation.type === 'attributes') {
            if (mutation.attributeName === 'data-onoff') { timerOnOff() }
            // else if(mutation.attributeName === 'data-date') { formatDatetimeElements()}
        };
    }
}


// Create an observer instance linked to the callback function
const observer = new MutationObserver(handleMutations);

// Options for the observer (which mutations to observe)
const config = {
    attributes: true,
    childList: true,
    subtree: true
};

// Start observing the document
observer.observe(document.body, config);

document.addEventListener('DOMContentLoaded', (event) => {

    const form = document.getElementById('newprojform');
    if (form) {

        form.addEventListener('submit', function (event) {
            event.preventDefault(); // Prevent form submission

            console.log("Form submit event triggered");

            const userID = document.getElementById('userID').value;
            const projName = document.getElementById('projname').value;
            const projDesc = document.getElementById('projDesc').value;

            const formData = {
                userID: userID,
                projName: projName,
                projDesc: projDesc
            };

            console.log(formData); // Print the collected data to the console

            fetch(`/project/newProjectCreate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.href = `/project/${data.projectID}`;
                    } else {
                        console.error('Failed to create project');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                }
                )
        })
    }
});

if (document.getElementById('addproject')) {
    document.getElementById('addproject').addEventListener('click', function () {
        const formContainer = document.getElementById('tempFormContainerAddProj');
        formContainer.innerHTML = `
        <form id="tempForm">
            <label for="userid">UserID:</label>
            <input type="number" id="userid" name="userid" required><br>
            <label for="projName">Project Name:</label>
            <input type="text" id="projName" name="projName" required><br>
            <label for="projDesc">Project Description:</label>
            <input type="text" id="projDesc" name="projDesc" required><br>

            <button type="submit">Submit</button>
        </form>
    `;

        document.getElementById('tempForm').addEventListener('submit', function (event) {
            event.preventDefault(); // Prevent form submission

            const userid = document.getElementById('userid').value;
            const projName = document.getElementById('projName').value;
            const projDesc = document.getElementById('projDesc').value;

            const formData = {
                userID: userid,
                projName: projName,
                projDesc: projDesc
            };

            console.log(formData); // Print the collected data to the console

            fetch('/project/newProjectCreate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Project added successfully!');
                        formContainer.innerHTML = ''; // Clear the form after submission
                        window.location.reload();
                    } else {
                        console.error('Failed to add counter');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        });
    });
};

if (document.getElementById('addcounter')) {
    document.getElementById('addcounter').addEventListener('click', function () {
        const formContainer = document.getElementById('tempFormContainer');
        formContainer.innerHTML = `
        <form id="tempForm">
            <label for="counterName">Name:</label>
            <input type="text" id="counterName" name="counterName" required><br>

            <label for="startingRow">Starting Row:</label>
            <input type="number" id="startingRow" name="startingRow" value="0" required><br>

            <button type="submit">Submit</button>
        </form>
    `;

        document.getElementById('tempForm').addEventListener('submit', function (event) {
            event.preventDefault(); // Prevent form submission

            const counterName = document.getElementById('counterName').value;
            const startingRow = document.getElementById('startingRow').value;
            const projectID = document.getElementById('addcounter').getAttribute('data-project-id')

            const formData = {
                counterName: counterName,
                startingRow: startingRow,
                projectID: projectID
            };

            fetch('/counter/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Counter added successfully!');
                        formContainer.innerHTML = ''; // Clear the form after submission
                        window.location.reload();
                    } else {
                        console.error('Failed to add counter');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Function to update the counter
    const updateCounter = (rowCtID, completedRow, action, eventDT, sessionID) => {
        const counterDisplay = document.querySelector(`.counterDisplay[data-rowCtID='${rowCtID}']`);
        const counterNotesField = document.querySelector(`.counternotes[data-rowCtID='${rowCtID}']`);
        const counterNotes = counterNotesField.value;
        const stitch = document.querySelector(`#stitchType-${rowCtID}[data-rowCtID='${rowCtID}']`).value;
        
        console.log(sessionID)
        if (action == '+'){
            counterDisplay.innerText = completedRow + 1;}
        else{counterDisplay.innerText = completedRow - 1;}

        const sendData = { value: completedRow, rowCtID: rowCtID, timestamp: eventDT, counterNotes: counterNotes, stitchType:stitch, sessionID:sessionID }
        console.log(sendData)

        fetch('/counter/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sendData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Counter value updated successfully');
                    counterNotesField.value = ''
                } else {
                    console.error('Failed to update counter value');
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
    };

    // Attach event listeners to increment and decrement buttons
    document.querySelectorAll('.counterButton-inc').forEach(button => {
        button.addEventListener('click', (event) => {
            const rowCtID = event.target.getAttribute('data-rowCtID');
            console.log(rowCtID)
            const counterDisplay = document.querySelector(`.counterDisplay[data-rowCtID='${rowCtID}']`);
            const sessionID = document.getElementById('sessionID').textContent;
            let counterValue = parseInt(counterDisplay.innerText, 10);
            console.log("Counter Value", counterValue)
            console.log("New Counter Value", counterValue + 1)
            console.log('SessionID',sessionID)
            const actionDT = new Date();
            updateCounter(rowCtID, counterValue, '+', actionDT,sessionID);
        });
    });

    document.querySelectorAll('.counterButton-dec').forEach(button => {
        button.addEventListener('click', (event) => {
            const rowCtID = event.target.getAttribute('data-rowCtID');
            const counterDisplay = document.querySelector(`.counterDisplay[data-rowCtID='${rowCtID}']`);
            const sessionID = document.getElementById('sessionID').value;
            let counterValue = parseInt(counterDisplay.innerText, 10);
            const actionDT = new Date();
            updateCounter(rowCtID, counterValue,'-', actionDT,sessionID);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/project/')){

    // if currentPath
    const runningElement = document.getElementById('running');
    const timerOnBtns = document.querySelectorAll('.actionbutton.timeron');
    const timerOFFBtns = document.querySelectorAll('.actionbutton.timeroff');
    const stitches = document.querySelectorAll('.stitches');
    const notes = document.querySelectorAll('.counternotes');

    const updateButtonVisibility = () => {
        const isON = runningElement.getAttribute('data-onoff')
        if (timerOnBtns){
        timerOnBtns.forEach(button => {
            if (isON=='0') {
                button.style.display = 'none'; // Show the button
            }
            else{
                button.style.display = 'inline'; // Show the button
            }
        })};

        if (timerOFFBtns){
            timerOFFBtns.forEach(button => {
                if ((button.innerText == 'Mark Project Complete' || button.innerText == '+ Add Counter')  && isON == '0'){
                    const togbutton = document.getElementById('toggleButton');

                    const completionDate = togbutton.getAttribute('data-completion-date');

                    if (completionDate == "In Progress") {
                        button.style.display = 'inline'; // Show the button
                    } else {
                        button.style.display = 'none'; // Hide the button
                    }}
                else if (isON=='0') {
                    button.style.display = 'inline'; // Show the button
                }
                else{
                    button.style.display = 'none'; // Show the button
                }
            })};

            if (stitches) {
                stitches.forEach(element => {
                    if (isON === '0') {
                        element.style.display = 'none'; // Show the element
                    } else {
                        element.style.display = 'inline'; // Hide the element
                    }});

        }
        if (notes) {
            notes.forEach(element => {
                if (isON === '0') {
                    element.style.display = 'none'; // Show the element
                } else {
                    element.style.display = 'inline'; // Hide the element
                }});

    }
    };

    // Initial visibility update
    updateButtonVisibility();

    // MutationObserver to detect changes to the data-off attribute
    const observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-onoff') {
                updateButtonVisibility();
            }
        }
    });

    observer.observe(runningElement, { attributes: true });

    // // Event listener to toggle the data-off attribute for demonstration purposes
    // runningElement.addEventListener('click', () => {
    //     const isOff = runningElement.getAttribute('data-onoff') === '0';
    //     runningElement.setAttribute('data-onoff', !isOff);
    // });
}
});

document.addEventListener('DOMContentLoaded', () => {
    const linkCells = document.querySelectorAll('.link-cell');

    linkCells.forEach(cell => {
        const text = cell.innerText;
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        // Split the text by URL
        const parts = text.split(urlRegex);

        // Create a new HTML content
        let newHtmlContent = '';

        parts.forEach(part => {
            if (urlRegex.test(part)) {
                // If the part matches the URL regex, make it a link
                newHtmlContent += `<a href="${part}" target="_blank">${part}</a>`;
            } else {
                // Otherwise, leave it as plain text
                newHtmlContent += part;
            }
        });

        // Update the cell's HTML content
        cell.innerHTML = newHtmlContent;
    });
});
