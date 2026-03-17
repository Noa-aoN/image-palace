---
name: deploy
description: Deploy to staging or production environment with pre-flight checks
disable-model-invocation: true
context: fork
allowed-tools: Bash(pnpm *), Bash(npm *), Bash(git *), Bash(gh *)
argument-hint: "[staging|production]"
---

Deploy to **$ARGUMENTS** environment.

## Pre-flight Checks

1. Ensure working directory is clean (`git status`)
2. Ensure you're on the correct branch
3. Run the full test suite
4. Run type checking
5. Run linting
6. Build the application

## Deploy

If all checks pass:

- **staging**: Deploy to staging environment
- **production**: Create a release tag and deploy

## Post-deploy

1. Verify the deployment health
2. Report the deployed version and URL

## Safety

- If ANY pre-flight check fails, **stop immediately** and report the failure
- Never deploy from an unclean working directory
- Never deploy production without all tests passing
