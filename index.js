// Create REST API
const express = require('express');

var bodyParser = require('body-parser')
const fs = require('fs');

// OCtokit
const { Octokit } = require("@octokit/rest");
const { Console } = require('console');
require('dotenv').config();
var ipRangeCheck = require("ip-range-check");

const app = express();

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

    // Get Githubs meta api for IPs
    // Use octokit to update file in github
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });


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

            if(projects.length > 6) {                    
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
                    projectData.dateTime = project.dateTime;
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
            var publishedProjectIds = [1]; // TODO add peridically the other projectIds

            for (var i = 0; i < publishedProjectIds.length; i++) {

                var projectName = "n/a";
                var maxScore = -1;
                var projectId = publishedProjectIds[i];

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
                        break;

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

                    // Limit team name to 50 chars
                    if (currentTeam.length > 50) {
                        currentTeam = currentTeam.substring(0, 50);
                    }

                    // Allow empty space and alphanumeric chars
                    currentTeam = currentTeam.replace(/[^a-zA-Z0-9 ]/g, "");

                    var currentScore = currentProject.score;
                    var bestScore = bestScores.find(x => x.teamName == currentTeam);
                    if (bestScore == undefined) {
                        bestScores.push({
                            projectId: projectId,
                            teamName: currentTeam,
                            score: currentScore,
                            passed: currentProject.passed,
                            failed: currentProject.failed
                        });
                    } else {
                        if (currentScore > bestScore.score) {
                            bestScore.score = currentScore;
                        }
                    }
                }

                // Sort the best scores by score
                bestScores.sort(function (a, b) {
                    return b.score - a.score;
                });

                // Create markdown table
                markdownTable += "| Position | Team | Score | % Score | Passing | Failing |\n";
                markdownTable += "| --- | --- | --- | --- | --- | --- |\n";
                for (var i = 0; i < bestScores.length; i++) {
                    var percentScore = Math.round(bestScores[i].score / maxScore * 10000) / 100;
                    markdownTable += "| " + (i + 1) + "| " + bestScores[i].teamName + " | " + bestScores[i].score + " | " + percentScore + " | " + bestScores[i].passed + " | " + bestScores[i].failed + " |\n";
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
                    content: Buffer.from(JSON.stringify(jsonData)).toString('base64'),
                    sha: response.data.sha
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
                            sha: response.data.sha
                        });


                    }).catch((error) => {
                        console.error(error);
                    });
                }, 5000);

                res.send('POST request to the homepage');
            });
        });
    });
});


app.listen(port, () =>
    console.log(`Example app listening on port ${port}!`),
);

