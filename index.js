// Create REST API
const express = require('express');
const helmet = require("helmet");

var bodyParser = require('body-parser')
const fs = require('fs');

// OCtokit
const { Octokit } = require("@octokit/rest");
const { Console } = require('console');
require('dotenv').config();
var ipRangeCheck = require("ip-range-check");

const app = express();

app.use(helmet());

var jsonParser = bodyParser.json()

const port = process.env.PORT;

app.get('/', (req, res) => res.send('Hello World!'));

// function that checks if an ip is in the list of IP subnets
function checkIP(ip, ipRanges) {

    console.log("Checking IP: " + ip);

    if (ip == "::1")
        return true; // Localhost

    for (var i = 0; i < ipRanges.length; i++) {
        if (ipRangeCheck(ip, ipRanges[i])) {
            return true;
        }
    }
    return false;
}


// Create endpoint for POST /api/test
app.post('/api/test', jsonParser, (req, res) => {


    try {



        // Get Githubs meta api for IPs
        // Use octokit to update file in github
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });
	

        var currentMaxProjectIdPublished = 1;

        // Get the current project by datetime
        // Determine the current project
        var project1Release = new Date(2022, 9, 26, 16, 0, 0, 0);
        var project2Release = new Date(2022, 10, 10, 16, 0, 0, 0);
        var project3Release = new Date(2022, 10, 24, 16, 0, 0, 0);
        var project4Release = new Date(2022, 11, 7, 16, 0, 0, 0);
        var project5Release = new Date(2022, 11, 21, 16, 0, 0, 0);
        var project6Release = new Date(2022, 12, 5, 16, 0, 0, 0);

        var now = new Date();

        if (now < project2Release) {
            currentMaxProjectIdPublished = 1;
        }
        else if (now < project3Release) {
            currentMaxProjectIdPublished = 2;
        }
        else if (now < project4Release) {
            currentMaxProjectIdPublished = 3;
        }
        else if (now < project5Release) {
            currentMaxProjectIdPublished = 4;
        }
        else if (now < project6Release) {
            currentMaxProjectIdPublished = 5;
        }
        else {
            currentMaxProjectIdPublished = 6;
        }

        console.log("Current Max Project Id Published: " + currentMaxProjectIdPublished);

        octokit.request('GET /meta').then(({ data }) => {
            // Get the IP address from the request
            var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		
            // Check if the IP is in the list of Githubs IP ranges for actions
            if (!checkIP(ip, data.actions)) {
                // Return forbidden
                res.status(403).send("Forbidden");
                return;
            }

            const json = req.body;

            var owner = "BattleRush";
            var repo = "ETH-CompilerDesignHS22-Leaderboard";
            var dataFile = "data.json";

            var data = {};

            if (json.teamName) {
                // Trim teamname to 50 characters
                json.teamName = json.teamName.substring(0, 50);
                data.teamName = json.teamName;
            } else {
                res.status(400).send('Missing teamName');
                return;
            }

            if (json.projects) {
                var projects = json.projects;
                data.projects = [];
                // Loop trough projects

                if (projects.length > 6) {
                    res.status(400).send('Too many project provided');
                }

                for (var i = 0; i < projects.length; i++) {
                    var project = projects[i];

                    // Verify the project has the fields we need
                    // If not, return 400
                    // Copy project fields to new json
                    var projectData = {};

                    if (project.projectId) {
                        projectData.projectId = project.projectId;
                    } else {
                        res.status(400).send('Missing projectId');
                        return;
                    }

                    // Skip this project as its not released yet
                    if(projectData.projectId > currentMaxProjectIdPublished) {
                        continue;
                    }

                    if (project.score != null) {
                        projectData.score = project.score;
                    } else {
                        res.status(400).send('Missing score');
                        return;
                    }

                    if (project.maxScore != null) {
                        projectData.maxScore = project.maxScore;
                    } else {
                        res.status(400).send('Missing maxScore');
                        return;
                    }

                    if (project.passed != null) {
                        projectData.passed = project.passed;
                    } else {
                        res.status(400).send('Missing passed');
                        return;
                    }

                    console.log(project);

                    if (project.failed != null) {
                        projectData.failed = project.failed;
                    } else {
                        res.status(400).send('Missing failed');
                        return;
                    }

                    if (project.dateTime) {
                        // Overwrite the datetime to prevent cheating
                        projectData.dateTime = new Date().toISOString();
                        //projectData.dateTime = project.dateTime;
                    } else {
                        res.status(400).send('Missing dateTime');
                        return;
                    }

                    // Add project to data
                    data.projects.push(projectData);
                }
            } else {
                res.status(400).send('Missing projects');
                return;
            }

            octokit.repos.getContent({
                owner: owner,
                repo: repo,
                path: dataFile,
            }).then((response) => {
                console.log(response.data.sha);

                var content = response.data.content;

                var decodedContent = Buffer.from(content, 'base64').toString('utf-8');
                var jsonData = JSON.parse(decodedContent);

                jsonData.push(data);

                // Create markdown leaderboard table for each project 
                var markdownTable = "# ETH Compiler Design HS22 Leaderboard\n\n";
                // Get best score for each time in each project and order by score

                // Get all projects
                for (var projectId = currentMaxProjectIdPublished; projectId > 0; --projectId) {

                    console.log("Project: " + projectId);

                    var projectName = "n/a";
                    var maxScore = -1;

                    switch (projectId) {
                        case 1:
                            projectName = "Project 1: Hellocaml";
                            maxScore = 67;
                            break;
                        case 2:
                            projectName = "Project 2: x86Lite";
                            maxScore = 46;
                            break;
                        case 3:
                            projectName = "Project 3: Compiling LLVM";
                            maxScore = 77;
                            break;
                        case 4:
                            projectName = "Project 4: Compiling Oat v.1";
                            maxScore = -1;
                            break;
                        case 5:
                            projectName = "Project 5: Compiling Full Oat";
                            maxScore = 80;
                            break;
                        case 6:
                            projectName = "Project 6: Dataflow Analysis and Register Allocation";
                            maxScore = 100;
                            break;

                        default:
                            projectName = "undefined";
                            maxScore = -1;
                            break;

                    }

                    // invalid test result
                    if(maxScore < 0){
                        continue;
                    }

                    markdownTable += "## " + projectName + "\n\n";
                    markdownTable += "### Max score: " + maxScore + "\n\n";

                    // Get all teams
                    var teams = [];
                    for (var i = 0; i < jsonData.length; i++) {
                        var team = jsonData[i].teamName;
                        if (!teams.includes(team)) {
                            teams.push(team);
                        }
                    }

                    // Loop trough data


                    // Get best score for each team in each project

                    var bestScores = [];
                    for (var i = 0; i < jsonData.length; i++) {
                        var projects = jsonData[i].projects;
                        var currentProject = projects.find(x => x.projectId == projectId);
                        if (!currentProject) {
                            continue; // Skip if the team didnt submit a score for this project
                        }

                        // Find if ther exits a bestScore for the currentTeam
                        var currentTeam = jsonData[i].teamName;

                        // Limit team name to 25 chars
                        if (currentTeam.length > 25) {
                            currentTeam = currentTeam.substring(0, 25);
                        }

                        // Allow empty space and alphanumeric chars
                        currentTeam = currentTeam.replace(/[^a-zA-Z0-9 ]/g, "");

 
                        var bestScore = bestScores.find(x => x.teamName == currentTeam);
                        if (bestScore == undefined) {
                            bestScores.push({
                                projectId: projectId,
                                teamName: currentTeam,
                                score: currentProject.score,
                                passed: currentProject.passed,
                                failed: currentProject.failed,
                                dateTime: currentProject.dateTime
                            });
                        } else {
                            // Take the values of better score
                            if (currentProject.score > bestScore.score) {
                                bestScore.score = currentProject.score;
                                bestScore.passed = currentProject.passed;
                                bestScore.failed = currentProject.failed;
                                bestScore.dateTime = currentProject.dateTime;
                            }

                            if(currentProject.score == bestScore.score){
                                if(currentProject.passed > bestScore.passed)
                                    bestScore.passed = currentProject.passed;

                                if(currentProject.failed < bestScore.failed)
                                    bestScore.failed = currentProject.failed;

                                // Update dateTime if the current score is the same but dateTime is newer
                                if(currentProject.dateTime < bestScore.dateTime)
                                    bestScore.dateTime = currentProject.dateTime;
                            }
                        }
                    }

                    // Sort the best scores by score and dateTime
                    bestScores.sort(function (a, b) {
                        if (a.score > b.score) {
                            return -1;
                        }
                        if (a.score < b.score) {
                            return 1;
                        }
                        if (a.dateTime < b.dateTime) {
                            return -1;
                        }
                        if (a.dateTime > b.dateTime) {
                            return 1;
                        }
                        return 0;
                    });

                    // If the project isnt the current max available one make the section markdown collapsed
                    
                    if (projectId < currentMaxProjectIdPublished) {
                        markdownTable += "<details>\n";
                        markdownTable += "<summary>Click to expand</summary>\n";
                        markdownTable += "\n";
                    }


                    // Create markdown table
                    markdownTable += "| Position | Team | Score | % Score | Passing | Failing | Time (CET/CEST) |\n";
                    markdownTable += "| --- | --- | --- | --- | --- | --- | --- |\n";
                    var prevScore = -1;
                    var prevPosition = -1;
                    for (var i = 0; i < bestScores.length; i++) {
                        var percentScore = Math.round(bestScores[i].score / maxScore * 10000) / 100;

                        var position = i + 1;
                        if(prevScore == bestScores[i].score) {
                            position = prevPosition;
                        } else {
                            prevPosition = position;
                        }
                        prevScore = bestScores[i].score;

                        // Print datetime in nice format
                        var dateTime = new Date(bestScores[i].dateTime);
                        var dateTimeString = dateTime.toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });

                        markdownTable += "| " + position + "| " + bestScores[i].teamName + " | " + bestScores[i].score + " | " + percentScore + " | " + bestScores[i].passed + " | " + bestScores[i].failed + " | " + dateTimeString + " |\n";
                    }

                    if(projectId < currentMaxProjectIdPublished) {
                        markdownTable += "\n";
                        markdownTable += "</details>\n";
                    }

                    markdownTable += "\n\n";
                }

                octokit.repos.getContent({
                    owner: owner,
                    repo: repo,
                    path: dataFile,
                }).then((response) => {
                    console.log(response.data.sha);

                    octokit.repos.createOrUpdateFileContents({
                        owner: owner,
                        repo: repo,
                        path: dataFile,
                        message: "Added new entry for team " + data.teamName,
                        content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
                        sha: response.data.sha,
                        author: {
                            name: "API User",
                            email: "api@api.com"
                        }
                    });

                    // Sleep for 5 seconds to make sure the file is commited before we commit the leaderboard
                    setTimeout(function () {
                        octokit.repos.getContent({
                            owner: owner,
                            repo: repo,
                            path: "README.md",
                        }).then((response) => {
                            console.log(response.data.sha);

                            octokit.repos.createOrUpdateFileContents({
                                owner: owner,
                                repo: repo,
                                path: "README.md",
                                message: "Update global leaderboard",
                                content: Buffer.from(markdownTable).toString('base64'),
                                sha: response.data.sha,
                                author: {
                                    name: "API User",
                                    email: "api@api.com"
                                }
                            });


                        }).catch((error) => {
                            console.error(error);
                        });
                    }, 5000);

                    res.send('POST request to the homepage');
                });
           });
        });
    } catch (error) {
        res.send(error);
    }
});


app.listen(port, () =>
    console.log(`Example app listening on port ${port}!`),
);

