import { describe, expect, it } from 'vitest';

import { findTool, toolDefinitions, toolList } from './tools.js';

// What the server offers is a promise: the app's own operations, named in its words,
// and nothing else. These are the checks that keep that list honest.

describe('the tool list', () => {
  it('offers one tool per operation, named in the app\u2019s vocabulary', () => {
    expect(toolList().map(tool => tool.name)).toEqual([
      'describe_clip',
      'cut',
      'annotate',
      'set_property',
      'remove_annotation',
      'undo',
      'seek',
      'start_take',
      'stop_take',
      'turn_source_on',
      'turn_source_off',
      'export_clip',
      'publish_clip',
    ]);
  });

  it('offers no tool that evaluates code or scripts the page', () => {
    // The guarantee is the list itself: a tool that ran code would have to be named
    // here, and this is the list. Nothing generic, nothing that takes a script.
    const forbidden = /eval|exec|script|run|code|shell|command|fetch|http|file|read|write|path/i;
    for (const tool of toolList()) expect(tool.name).not.toMatch(forbidden);
  });

  it('describes every tool with a schema an agent can act on', () => {
    for (const tool of toolList()) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('hands the protocol the names, descriptions and schemas, and no implementation', () => {
    for (const definition of toolDefinitions()) {
      expect(Object.keys(definition).sort()).toEqual(['description', 'inputSchema', 'name']);
    }
  });

  it('finds a tool by name, and nothing for a name it does not offer', () => {
    expect(findTool('describe_clip')?.name).toBe('describe_clip');
    expect(findTool('run_anything')).toBeNull();
  });

  it('names each operation in the app\u2019s words, with the inputs the app takes', () => {
    const byName = new Map(toolList().map(tool => [tool.name, tool]));
    // The stretch a cut or an annotation is shown over is a fraction of the clip,
    // as everywhere else in the app, so a tool call and a person's edit mean the
    // same moment.
    for (const name of ['cut', 'annotate']) {
      const schema = byName.get(name)!.inputSchema;
      expect(schema.type).toBe('object');
    }
    expect(byName.get('cut')!.inputSchema.required).toEqual(['from', 'to']);
    expect(byName.get('set_property')!.inputSchema.required).toEqual(['id', 'property', 'value']);
    expect(byName.get('seek')!.inputSchema.required).toEqual(['seconds']);
    for (const name of ['turn_source_on', 'turn_source_off']) {
      expect(byName.get(name)!.inputSchema.required).toEqual(['source']);
    }
    // The kinds an agent may make are the ones whose shape is data.
    expect(byName.get('annotate')!.inputSchema.properties).toMatchObject({
      kind: { enum: ['arrow', 'text'] },
    });
    // An export writes one of the two containers the app writes.
    expect(byName.get('export_clip')!.inputSchema).toMatchObject({
      required: ['target'],
      properties: { target: { enum: ['webm', 'mp4'] } },
    });
  });

  it('offers no tool that reads or writes a file of its own', () => {
    // `export_clip` writes a file, but it is the file the *app* writes, taken from the
    // browser's own download; no tool takes a path, and none reaches the disk.
    const paths = toolList().flatMap(tool => Object.keys(tool.inputSchema.properties ?? {}));
    expect(paths.some(key => /path|file|dir/i.test(key))).toBe(false);
  });
});
