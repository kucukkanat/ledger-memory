/**
 * Design tokens for LEDGER, lifted from the source design.
 *
 * The CSS custom properties in `tokens.css` are the single source of truth for
 * anything the browser renders. This module mirrors them for the places that
 * cannot read CSS — the `<canvas>` visualisation and the CLI's ANSI output —
 * so a palette change stays a one-file change.
 */
export declare const color: {
    /** Page background. */
    readonly bg: "#0a0b0c";
    /** Canvas background, one step darker than the page. */
    readonly bgSunken: "#08090a";
    /** Panels, headers, sidebars. */
    readonly surface: "#0d0f11";
    /** Rails and facet columns. */
    readonly surfaceAlt: "#0c0e10";
    /** Hover fill for rows and list items. */
    readonly surfaceHover: "#141719";
    /** Inset wells: inputs, chunk previews. */
    readonly surfaceInset: "#0e1012";
    /** Structural borders. */
    readonly border: "#202427";
    /** Borders on interactive controls. */
    readonly borderStrong: "#2b3036";
    /** Hairlines between dense rows. */
    readonly borderSubtle: "#141719";
    /** Primary body text. */
    readonly text: "#e7e9eb";
    /** Secondary text. */
    readonly textMuted: "#a9b0b7";
    /** Tertiary text and inactive labels. */
    readonly textDim: "#868d95";
    /** Quaternary text, metadata. */
    readonly textFaint: "#575e66";
    /** Section eyebrows and disabled glyphs. */
    readonly textGhost: "#4e555c";
    /** The faintest legible step. */
    readonly textTrace: "#3f464c";
    /** The brand accent — selection, focus, "this is live". */
    readonly accent: "#c0f24a";
    /** Accent on hover. */
    readonly accentBright: "#d8ff7d";
    /** Accent-tinted surface for selection bars. */
    readonly accentSurface: "#151a10";
    /** Accent-tinted border. */
    readonly accentBorder: "#2f3a1a";
    /** Accent at low emphasis, for equaliser bars. */
    readonly accentDim: "#4d5f24";
    /** Conflicts, drops, decay. */
    readonly danger: "#e0555f";
    readonly dangerBorder: "#4a2429";
    readonly dangerSurface: "#1c1012";
    /** Warnings, stale values. */
    readonly warn: "#f2913f";
    readonly warnSurface: "#14100c";
    readonly warnBorder: "#2a2119";
};
/** Cluster colours, keyed by the seeded cluster ids. */
export declare const clusterColor: {
    readonly prefs: "#b7c14a";
    readonly people: "#4a9fd4";
    readonly code: "#cf6fb8";
    readonly travel: "#4fb8a8";
    readonly health: "#6fbf73";
    readonly money: "#d9a03c";
    readonly home: "#6f86e0";
    readonly reading: "#9a76dd";
    readonly proc: "#e0793f";
    readonly projects: "#d6606a";
};
/** Fallback palette for clusters created after the seed, applied by index. */
export declare const clusterPalette: ("#b7c14a" | "#4a9fd4" | "#cf6fb8" | "#4fb8a8" | "#6fbf73" | "#d9a03c" | "#6f86e0" | "#9a76dd" | "#e0793f" | "#d6606a")[];
export declare const font: {
    readonly sans: "'Instrument Sans', system-ui, -apple-system, sans-serif";
    readonly mono: "'Geist Mono', ui-monospace, SFMono-Regular, monospace";
};
export declare const radius: {
    /** LEDGER is a square-cornered interface; 2px is the only radius. */
    readonly sm: "2px";
    readonly pill: "999px";
};
export declare const space: {
    readonly '0.5': "2px";
    readonly '1': "4px";
    readonly '1.5': "6px";
    readonly '2': "8px";
    readonly '3': "12px";
    readonly '4': "16px";
    readonly '5': "20px";
    readonly '6': "24px";
    readonly '8': "32px";
};
export declare const fontSize: {
    /** Eyebrows: uppercase, letterspaced. */
    readonly eyebrow: "9px";
    readonly micro: "10px";
    readonly tiny: "11px";
    readonly small: "12.5px";
    readonly body: "13px";
    readonly large: "15px";
    readonly title: "17px";
    readonly display: "27px";
};
export declare const duration: {
    readonly fast: "120ms";
    readonly base: "150ms";
    readonly slow: "220ms";
};
export declare const easing: {
    readonly standard: "cubic-bezier(.2,.8,.2,1)";
};
/** Strength thresholds shared by the table bar, the inspector and the canvas. */
export declare const strengthScale: readonly [{
    readonly min: 0.7;
    readonly color: "#c0f24a";
    readonly label: "strong";
}, {
    readonly min: 0.4;
    readonly color: "#d9a03c";
    readonly label: "holding";
}, {
    readonly min: 0;
    readonly color: "#e0555f";
    readonly label: "decaying";
}];
export declare const strengthColor: (strength: number) => string;
//# sourceMappingURL=index.d.ts.map