import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import * as cheerio from 'cheerio'
import extractZip from 'extract-zip'
import tempy from 'tempy'

const getError = (err: unknown) => (err instanceof Error ? err.message : 'Unknown error')
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const FOUNTAIN_SCENE_PREFIXES = [
  'INT',
  'EXT',
  'EST',
  'INT./ EXT',
  'INT / EXT',
  'I / E',
]

const celtxToFountain = async (file: string): Promise<string> => {
  const fileName = path.basename(file)
  const dir = tempy.directory()

  try {
    await extractZip(file, { dir })
  } catch (err) {
    throw new Error(`Could not unzip ${fileName}: ${getError(err)}`)
  }

  const files = await readdir(dir)
  const projectFile = files.find(file => path.basename(file) === 'project.rdf')

  if (!projectFile) {
    throw new Error(`Could not find project file in ${fileName}`)
  }

  const projectFilePath = path.join(dir, projectFile)
  const $ = cheerio.load(await readFile(projectFilePath))
  const scriptFile = $('cx\\:Document[RDF\\:about="http\\://celtx.com/res/1kEqvojZWTHA"]')
    ?.attr('cx:localfile')

  if (!scriptFile) {
    throw new Error(`Could not extract script file from project in ${fileName}`)
  }

  const scriptFilePath = path.join(dir, scriptFile)
  const $$ = cheerio.load(await readFile(scriptFilePath))

  let output = ''

  $$('body').children().each((_, node) => {
    const text = $$(node).text().trim()

    switch ($$(node).attr('class')) {
      case 'firstpagespacer':
        break
      case 'sceneheading': {
        const usesStandardPrefix = FOUNTAIN_SCENE_PREFIXES
          .some(prefix => text.toUpperCase().startsWith(prefix))

        if (!usesStandardPrefix) {
          output += '!'
        }

        output += text + '\n\n'
        break
      }
      case 'action':
        output += text + '\n\n'
        break
      case 'character': {
        const isUpperCase = text === text.toUpperCase()

        if (!isUpperCase) {
          output += '@'
        }

        output += text + '\n'
        break
      }
      case 'dialog':
        output += text + '\n\n'
        break
      case 'parenthetical':
        output += text + '\n'
        break
      case 'transition':
        if (!text.endsWith('TO:')) {
          output += '> '
        }

        output += text + '\n'
        break
    }
  })

  return output
}

export default celtxToFountain
