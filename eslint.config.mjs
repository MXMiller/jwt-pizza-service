//import js from "@eslint/js";
import globals from "globals";
import pluginJs from '@eslint/js';
//import { defineConfig } from "eslint/config";

export default [
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  { languageOptions: { globals: globals.node } },
  { languageOptions: { globals: globals.jest } },
  pluginJs.configs.recommended,
];