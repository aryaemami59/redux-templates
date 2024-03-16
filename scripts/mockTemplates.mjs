#!/usr/bin/env node

import { exec as _exec } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(_exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const listYarnWorkspaces = async () => {
  try {
    // Execute `yarn workspaces list --json` command
    const { stdout } = await exec('yarn workspaces list --json')

    // The output includes multiple JSON lines, one for each workspace.
    // Split stdout by newlines and filter out empty lines or lines that are not JSON (like yarn logs)
    const workspaces = stdout
      .split('\n')
      .filter((line) => {
        try {
          JSON.parse(line)
          return true
        } catch (error) {
          return false
        }
      })
      .map((line) => JSON.parse(line))
      .filter(({ location }) => location !== '.')

    // Extract workspace names or any other property you need
    const workspaceNames = new Map(
      workspaces.map((workspace) => [
        workspace.name,
        path.resolve(__dirname, '..', workspace.location),
      ]),
    )

    return workspaceNames
  } catch (error) {
    console.error('Failed to list Yarn workspaces:', error)
    throw error
  }
}

const workspaces = await listYarnWorkspaces()

async function constructGitHubUrl() {
  try {
    const remoteUrl = (await exec('git remote get-url origin')).stdout.trim()

    const currentBranch = (
      await exec('git branch --show-current')
    ).stdout.trim()

    const commitHash = (await exec('git rev-parse --short HEAD')).stdout.trim()

    return {
      remoteUrl,
      currentBranch,
      commitHash,
    }
  } catch (error) {
    console.error(`Error: ${error}`)
  }
}

const gitHubUrl = await constructGitHubUrl()

const allTemplates = {
  'cra-template-redux': `npx create-react-app example --template file:${workspaces?.get('cra-template-redux')}`,
  'cra-template-redux-typescript': `npx create-react-app@latest example --template file:${workspaces?.get('cra-template-redux-typescript')}`,
  'expo-template-redux-typescript': `npx create-expo@latest example --template file:${workspaces?.get('expo-template-redux-typescript')}`,
  'react-native-template-redux-typescript': `npx react-native@latest init app --template file:${workspaces?.get('react-native-template-redux-typescript')} --pm=npm --directory example`,
  // tiged has issues with commit hashes https://github.com/tiged/tiged/pull/89, https://github.com/tiged/tiged/issues/90, so until that is fixed, we will just use the branch name.
  'vite-template-redux': `npx tiged --mode=git ${gitHubUrl?.remoteUrl}/packages/vite-template-redux#${gitHubUrl?.currentBranch} example -v && cd example && npm install`,
}

const mockTemplate = async (template) => {
  await exec(allTemplates[template])
}

await mockTemplate(process.argv[2])
