export declare const paint: (hex: string, text: string) => string;
export declare const dim: (text: string) => string;
export declare const muted: (text: string) => string;
export declare const accent: (text: string) => string;
export declare const danger: (text: string) => string;
export declare const warn: (text: string) => string;
export declare const bold: (text: string) => string;
/** Colour a 0..1 strength the same way the table bar does. */
export declare const strengthTint: (strength: number) => string;
export declare const bar: (fraction: number, width?: number) => string;
/** Collapse to one line first — chunk text is multi-line and would break a table row. */
export declare const truncate: (text: string, width: number) => string;
/** Compact relative age, matching the UI's "3d" / "4mo" convention. */
export declare const ago: (from: number, now: number) => string;
export declare const write: (line?: string) => void;
export declare const heading: (title: string, subtitle?: string) => void;
//# sourceMappingURL=term.d.ts.map