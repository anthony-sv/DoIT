import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CanvasFileError,
  type DiagramData,
  type WhiteboardData,
  assertSameKind,
  debounce,
  isEmptyDrawing,
  readCanvasFile,
  storedData,
  toBundle,
  toNativeFile,
} from './canvas-file'

const rectangle = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }

const whiteboard: WhiteboardData = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [rectangle],
  appState: { viewBackgroundColor: '#ffffff', gridSize: 20 },
  files: {},
}

const diagramXml =
  '<mxfile host="embed.diagrams.net"><diagram id="d1" name="Page-1"><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="Box" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>' +
  '</root></mxGraphModel></diagram></mxfile>'

const blankDiagramXml =
  '<mxfile host="embed.diagrams.net"><diagram id="d1" name="Page-1"><mxGraphModel><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'

// What draw.io writes with compressXml on: deflated, base64 page content.
const compressedDiagramXml =
  '<mxfile host="app.diagrams.net"><diagram id="d1" name="Page-1">jZJNT8MwDIZ/Ta5T2rAdtpGxC4cJiZ2j1msj0riK3a3w60nbdIwJIXGx8vjxa8cRK7Ht+mcjm/YVS1QiGfWLUM9JTrPV5jPdIKTZYrPKIjFa+jLXmFjZ</diagram></mxfile>'

function file(content: string, name: string) {
  return new File([content], name)
}

describe('readCanvasFile', () => {
  it('reads a DoIT whiteboard file', async () => {
    const bundle = JSON.stringify(toBundle('whiteboard', 'Sketch', whiteboard))
    await expect(readCanvasFile(file(bundle, 'Sketch.doit.json'))).resolves.toEqual({
      kind: 'whiteboard',
      name: 'Sketch',
      data: whiteboard,
    })
  })

  it('reads a DoIT diagram file', async () => {
    const bundle = JSON.stringify(toBundle('diagram', 'Flow', { xml: diagramXml }))
    await expect(readCanvasFile(file(bundle, 'export.json'))).resolves.toEqual({
      kind: 'diagram',
      name: 'Flow',
      data: { xml: diagramXml },
    })
  })

  it('names a DoIT file without a name after the file, minus .doit.json', async () => {
    const bundle = JSON.stringify({ ...toBundle('diagram', '', { xml: diagramXml }), name: undefined })
    const read = await readCanvasFile(file(bundle, 'Release flow.doit.json'))
    expect(read.name).toBe('Release flow')
  })

  it('rejects a DoIT file whose drawing does not match its kind', async () => {
    const bundle = JSON.stringify({ doit: 'canvas', version: 1, kind: 'diagram', name: 'X', data: whiteboard })
    await expect(readCanvasFile(file(bundle, 'x.json'))).rejects.toThrow(/damaged/)
  })

  it('reads a plain .excalidraw file as a whiteboard named after the file', async () => {
    await expect(readCanvasFile(file(JSON.stringify(whiteboard), 'Plan.excalidraw'))).resolves.toEqual({
      kind: 'whiteboard',
      name: 'Plan',
      data: whiteboard,
    })
  })

  it('drops iframe elements and session appState from a whiteboard file', async () => {
    const iframe = { type: 'iframe', customData: { generationData: { status: 'done', html: '<script></script>' } } }
    const shared = {
      ...whiteboard,
      elements: [rectangle, iframe],
      appState: { viewModeEnabled: true, errorMessage: 'x', viewBackgroundColor: '#000' },
    }
    const read = await readCanvasFile(file(JSON.stringify(shared), 'Shared.excalidraw'))
    expect(read.data).toEqual({ ...whiteboard, elements: [rectangle], appState: { viewBackgroundColor: '#000' } })
  })

  it('reads draw.io XML as a diagram, kept as is', async () => {
    await expect(readCanvasFile(file(diagramXml, 'Architecture.drawio'))).resolves.toEqual({
      kind: 'diagram',
      name: 'Architecture',
      data: { xml: diagramXml },
    })
  })

  it('reads draw.io XML with a prolog and compressed pages', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${compressedDiagramXml}`
    const read = await readCanvasFile(file(xml, 'old.xml'))
    expect(read).toEqual({ kind: 'diagram', name: 'old', data: { xml } })
  })

  it('rejects XML that is not a draw.io diagram', async () => {
    await expect(readCanvasFile(file('<?xml version="1.0"?><svg/>', 'a.xml'))).rejects.toThrow(
      /isn’t a draw\.io diagram/,
    )
  })

  it('rejects a .tldr file with a message that says why', async () => {
    const tldr = JSON.stringify({ tldrawFileFormatVersion: 1, schema: {}, records: [] })
    const reading = readCanvasFile(file(tldr, 'board.tldr'))
    await expect(reading).rejects.toBeInstanceOf(CanvasFileError)
    await expect(reading).rejects.toThrow(/tldraw \(\.tldr\) files can’t be opened here/)
  })

  it('rejects an Excalidraw library', async () => {
    const library = JSON.stringify({ type: 'excalidrawlib', version: 2, libraryItems: [] })
    await expect(readCanvasFile(file(library, 'shapes.excalidrawlib'))).rejects.toThrow(/library/)
  })

  it('rejects garbage text', async () => {
    const reading = readCanvasFile(file('not a drawing at all', 'notes.txt'))
    await expect(reading).rejects.toBeInstanceOf(CanvasFileError)
    await expect(reading).rejects.toThrow(/can’t read this file/)
  })

  it('rejects JSON it does not recognize', async () => {
    await expect(readCanvasFile(file('{"hello":"world"}', 'data.json'))).rejects.toThrow(/recognize/)
    await expect(readCanvasFile(file('null', 'null.json'))).rejects.toThrow(/recognize/)
  })

  it('keeps names within 80 characters', async () => {
    const read = await readCanvasFile(file(diagramXml, `${'x'.repeat(120)}.drawio`))
    expect(read.name).toHaveLength(80)
  })
})

describe('assertSameKind', () => {
  it('accepts a file of the same kind', () => {
    expect(() => assertSameKind('diagram', 'diagram')).not.toThrow()
  })

  it('rejects a file of the other kind and points to the sidebar import', () => {
    expect(() => assertSameKind('diagram', 'whiteboard')).toThrow(CanvasFileError)
    expect(() => assertSameKind('diagram', 'whiteboard')).toThrow(
      /file is a diagram and this drawing is a whiteboard.*Import file…/,
    )
  })
})

describe('storedData', () => {
  it('treats the column default {} as a new, empty drawing', () => {
    expect(storedData('whiteboard', {})).toBeNull()
    expect(storedData('diagram', {})).toBeNull()
  })

  it('returns data that matches the kind', () => {
    expect(storedData('whiteboard', whiteboard)).toEqual(whiteboard)
    expect(storedData('diagram', { xml: diagramXml })).toEqual({ xml: diagramXml })
  })

  it('cleans a whiteboard that was stored raw', () => {
    const damaged = { ...whiteboard, elements: [null, rectangle], appState: 'x' }
    expect(storedData('whiteboard', damaged)).toEqual({ ...whiteboard, appState: {} })
  })

  it('ignores data of the other kind', () => {
    expect(storedData('whiteboard', { xml: diagramXml })).toBeNull()
    expect(storedData('diagram', whiteboard)).toBeNull()
  })
})

describe('isEmptyDrawing', () => {
  it('counts no data and blank documents as empty', () => {
    expect(isEmptyDrawing(null)).toBe(true)
    expect(isEmptyDrawing({ ...whiteboard, elements: [] })).toBe(true)
    expect(isEmptyDrawing({ xml: '' })).toBe(true)
    expect(isEmptyDrawing({ xml: blankDiagramXml })).toBe(true)
  })

  it('ignores deleted whiteboard elements', () => {
    expect(isEmptyDrawing({ ...whiteboard, elements: [{ ...rectangle, isDeleted: true }] })).toBe(true)
  })

  it('reads damaged whiteboard elements as nothing instead of throwing', () => {
    expect(isEmptyDrawing({ ...whiteboard, elements: [null] })).toBe(true)
  })

  it('sees shapes and lines', () => {
    expect(isEmptyDrawing(whiteboard)).toBe(false)
    expect(isEmptyDrawing({ xml: diagramXml })).toBe(false)
    const edge = blankDiagramXml.replace(
      '</root>',
      '<mxCell id="3" edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell></root>',
    )
    expect(isEmptyDrawing({ xml: edge })).toBe(false)
  })

  it('assumes a compressed diagram has content', () => {
    expect(isEmptyDrawing({ xml: compressedDiagramXml })).toBe(false)
  })
})

describe('toNativeFile', () => {
  it('writes a whiteboard as an .excalidraw file with a safe name', async () => {
    const native = toNativeFile('whiteboard', 'Q3: plan/draft', whiteboard)
    expect(native.name).toBe('Q3- plan-draft.excalidraw')
    expect(JSON.parse(await native.text())).toEqual(whiteboard)
  })

  it('writes a diagram as a .drawio file, and a valid one when it is empty', async () => {
    const native = toNativeFile('diagram', 'Flow', { xml: diagramXml } satisfies DiagramData)
    expect(native.name).toBe('Flow.drawio')
    expect(await native.text()).toBe(diagramXml)
    const blank = await toNativeFile('diagram', 'New', { xml: '' }).text()
    expect(blank).toMatch(/^<mxfile>.*<mxGraphModel>.*<\/mxfile>$/)
  })

  it('round-trips through readCanvasFile', async () => {
    const native = toNativeFile('whiteboard', 'Plan', whiteboard)
    await expect(readCanvasFile(native)).resolves.toEqual({
      kind: 'whiteboard',
      name: 'Plan',
      data: whiteboard,
    })
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls once with the last arguments after the wait', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const save = debounce(fn, 1000)
    save('a')
    save('b')
    vi.advanceTimersByTime(999)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('flushes a pending call at once, and only once', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const save = debounce(fn, 1000)
    save('a')
    save.flush()
    save.flush()
    vi.advanceTimersByTime(2000)
    expect(fn).toHaveBeenCalledExactlyOnceWith('a')
  })

  it('drops a pending call on cancel', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const save = debounce(fn, 1000)
    save('a')
    save.cancel()
    save.flush()
    vi.advanceTimersByTime(2000)
    expect(fn).not.toHaveBeenCalled()
  })
})
