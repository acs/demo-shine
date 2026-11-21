import { describe, expect, it } from 'vitest';

import { findTool, toolDefinitions, toolList } from './tools.js';

// What the server offers is a promise: the app's own operations, named in its words,
// and nothing else. These are the checks that keep that list honest.

describe('the tool list', () => {
  it('offers one tool per operation, named in the app\u2019s vocabulary', () => {
    expect(toolList().map(tool => tool.name)).toEqual(['describe_clip']);
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
});
