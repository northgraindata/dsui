/**
 * Shaper mark, redrawn as a vector from Taleshape's public GitHub avatar.
 *
 * It sits on a white tile because the mark is near-black and DSUI is dark.
 * Confirm branding terms with Taleshape before publishing, then swap in their
 * official SVG if they provide one; only the data URI below depends on it.
 */
const shaperLogo =
  "%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22 width=%2264%22 height=%2264%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%23ffffff%22/%3E%3Cg transform=%22translate%280.41 0.75%29 scale%280.135%29%22%3E%3Cpolygon points=%22219,56 332,134 287,169 228,130 190,160 336,257 336,333 229,407 132,343 132,264 219,317 265,281 132,191 132,115%22 fill=%22%231a1a1a%22/%3E%3Cpolygon points=%22162,227 219,262 219,312 162,277%22 fill=%22%23ff1a75%22/%3E%3C/g%3E%3C/svg%3E";

export const shaperIconUrl = `data:image/svg+xml,${shaperLogo}`;
