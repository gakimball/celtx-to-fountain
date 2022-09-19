import * as path from 'node:path'
import celtxToFountain from './index.js';

const output = await celtxToFountain(path.join(process.cwd(), 'test.celtx'))

process.stdout.write(output)
