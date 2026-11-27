/**
 * Design-system rules Biome cannot express for shared CSS: colors come from
 * tokens everywhere, and layout containers space children only with spacing
 * tokens. The application shell (`apps/*`) is not covered yet.
 */
const IGNORED_COLOR_VALUES = [
  "currentColor",
  "currentcolor",
  "transparent",
  "inherit",
  "none",
  "initial",
  "unset",
  "/^color-mix\\(/",
];

const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "border-color",
  "fill",
  "stroke",
];

export default {
  plugins: ["stylelint-declaration-strict-value"],
  reportDescriptionlessDisables: true,
  reportNeedlessDisables: true,
  rules: {
    // Raw colors, in any property, belong in the token block.
    "color-no-hex": true,
    "color-named": "never",
    "scale-unlimited/declaration-strict-value": [
      COLOR_PROPERTIES,
      { ignoreValues: IGNORED_COLOR_VALUES },
    ],
  },
  overrides: [
    {
      // The one place raw colors are declared.
      files: ["packages/ui/src/styles.css"],
      rules: { "color-no-hex": null },
    },
    {
      files: ["packages/adapter-sdk/src/styles/layout.css"],
      rules: {
        "scale-unlimited/declaration-strict-value": [
          [...COLOR_PROPERTIES, "/gap$/"],
          { ignoreValues: [...IGNORED_COLOR_VALUES, "0"] },
        ],
      },
    },
  ],
};
