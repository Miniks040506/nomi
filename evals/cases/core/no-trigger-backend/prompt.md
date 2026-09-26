---
description: A backend-only change must not activate Nomi.
tags: [core]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, TodoWrite]
---
In server.js, add validation to the POST /users handler: respond with status 400 and a JSON error message when the email is missing or is not a valid email address.
