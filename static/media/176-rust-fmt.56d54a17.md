---
title: "Rust Formatter Configruation"
date: 2023-09-10
id: blog0176
tag: rust
intro: "Record a configuration for auto-formattting."
toc: false
---

Create a `rustfmt.toml` at the project root level, then use

```text
edition = "2018"
color = "Auto"
unstable_features = true

# Width
max_width = 140

# Layout
indent_style = "Block"
brace_style = "PreferSameLine"
control_brace_style = "AlwaysSameLine"
imports_indent = "Block"
fn_args_layout = "Compressed"
match_arm_blocks = true

# Delimiter
trailing_comma = "Vertical"
trailing_semicolon = true
match_block_trailing_comma = false
binop_separator = "Front"
overflow_delimited_expr = true

# Line
newline_style = "Unix"
fn_single_line = true
struct_lit_single_line = true
where_single_line = false
empty_item_single_line = true
wrap_comments = true
blank_lines_lower_bound = 0
blank_lines_upper_bound = 1

# Space
tab_spaces = 4
hard_tabs = false
space_after_colon = true
space_before_colon = false
spaces_around_ranges = false
space_around_attr_eq = true
combine_control_expr = true
type_punctuation_density = "Wide"
struct_field_align_threshold = 0
enum_discrim_align_threshold = 0

# Simplification
use_field_init_shorthand = true
use_try_shorthand = true
remove_nested_parens = true
merge_derives = true
merge_imports = true
normalize_comments = false
normalize_doc_attributes = true
condense_wildcard_suffixes = true

# Sort
reorder_imports = true
reorder_modules = true
reorder_impl_items = true

# Force
force_explicit_abi = true
force_multiline_blocks = false

# Format
disable_all_formatting = false
format_code_in_doc_comments = true
format_macro_matchers = true
format_macro_bodies = true
format_strings = true

# Error
error_on_line_overflow = false
error_on_unformatted = false
hide_parse_errors = false
```
