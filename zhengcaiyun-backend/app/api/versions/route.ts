import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

import { getActorFromRequest } from '@/lib/request-actor'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'versions.json')

const DEFAULT_VERSIONS = {
  chrome: {
    version: 'v1.2.0',
    date: '2025-11-20',
    size: '2.5 MB',
    link: '#'
  },
  windows: {
    version: 'v1.0.5',
    date: '2025-11-15',
    size: '45.2 MB',
    link: '#'
  }
}

export async function GET(request: NextRequest) {
  const actor = await getActorFromRequest(request)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)

    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8')
      return NextResponse.json(JSON.parse(data))
    }
  } catch {
    // ignore
  }

  return NextResponse.json(DEFAULT_VERSIONS)
}

