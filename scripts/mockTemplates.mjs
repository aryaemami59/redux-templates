#!/usr/bin/env node

import { exec as _exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(_exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getCommitHash = async () => {
  try {
    const { stdout } = await exec('git rev-parse --short HEAD')
    return stdout.trim()
  } catch (error) {
    console.error('Failed to get commit hash:', error)
    throw error
  }
}

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

const commitHash = await getCommitHash()

const outputFolderNames = new Map([
  ['cra-template-redux', `cra-js-app`],
  ['cra-template-redux-typescript', `cra-ts-app`],
  ['expo-template-redux-typescript', `expo-ts-app`],
  ['react-native-template-redux-typescript', `rn-ts-app`],
  ['vite-template-redux', `vite-ts-app`],
])

const allTemplates = {
  // 'cra-template-redux': `npx create-react-app example --template file:${workspaces?.get('cra-template-redux')}`,
  // 'cra-template-redux-typescript': `npx create-react-app@latest example --template file:${workspaces?.get('cra-template-redux-typescript')}`,
  'expo-template-redux-typescript': `npx create-expo@latest example --template file:${workspaces?.get('expo-template-redux-typescript')}`,
  // 'react-native-template-redux-typescript': `npx react-native@latest init app --template file:${workspaces?.get('react-native-template-redux-typescript')} --pm=npm --directory example`,
  // 'vite-template-redux': `npx tiged https://github.com/aryaemami59/redux-templates/packages/vite-template-redux#convert-to-monorepo example -v`,
}

const mockTemplate = async (template) => {
  await exec(allTemplates[template])
}

const matrixList = Object.values(allTemplates).map((pkg) => ({
  package: pkg,
}))

const includeStatement = { include: matrixList }
// console.log(`::set-output name=matrix::${JSON.stringify(includeStatement)}`)

const removeMockedTemplateDirectory = async (outputFolderName) => {
  await fs.rm(path.resolve(__dirname, '..', outputFolderName), {
    recursive: true,
    force: true,
  })
}

const mockTemplates = async () => {
  Object.entries(allTemplates).forEach(async ([templateName, command]) => {
    const outputFolderName = outputFolderNames.get(templateName)
    console.log(`Mocking ${templateName}...`)
    try {
      const { stdout } = await exec(command)
      console.log(stdout)
    } catch (err) {
      console.error(err)
      console.log(`Failed to create ${templateName}! Exiting...`)
      await removeMockedTemplateDirectory(outputFolderName)
      process.exit(1)
    }

    try {
      console.log('Running tests...')
      // const { stdout } = await exec(
      //   `cd ${outputFolderName} && set CI=true && npm run test`,
      // )
      // console.log(stdout)
    } catch (err) {
      console.error(err)
      console.log(`Tests failed for ${templateName}! Exiting...`)
      await removeMockedTemplateDirectory(outputFolderName)
      process.exit(1)
    }

    try {
      console.log('Building...')
      // const { stdout } = await exec(`cd ${outputFolderName} && npm run build`)
      // console.log(stdout)
    } catch (err) {
      console.error(err)
      console.log(`Build failed for ${templateName}! Exiting...`)
      process.exit(1)
    } finally {
      console.log('Cleaning up...')
      await removeMockedTemplateDirectory(outputFolderName)
    }
  })
}

// await mockTemplates()

mockTemplate(process.argv[2])
