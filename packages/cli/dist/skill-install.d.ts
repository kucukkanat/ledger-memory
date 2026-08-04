/**
 * Install the skill into an agent's configuration.
 *
 * Two things happen: the skill markdown is copied where the agent looks for
 * skills, and the MCP endpoint is added to its config. Existing config is read,
 * merged and written back — clobbering a user's MCP settings to add one entry
 * would be a poor trade.
 */
export type AgentTarget = 'claude' | 'claude-code' | 'print';
export type InstallOptions = {
    readonly agent: AgentTarget;
    readonly url: string;
    /** Install for every project (home directory) rather than this one. */
    readonly global: boolean;
    readonly cwd: string;
};
export declare const install: (options: InstallOptions) => Promise<void>;
/** The config snippet, for agents this command does not know how to configure. */
export declare const configSnippet: (url: string) => string;
//# sourceMappingURL=skill-install.d.ts.map