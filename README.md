# guify

Root files are library-oriented.

- `guify-core.js`: reusable browser core for creating p5 GUI controls and reactive sketch globals.
- `example/`: demo app that consumes the library.

## Quick browser usage

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.js"></script>
<script src="./guify-core.js"></script>
<script>
  // Example
  Guify.guify("radius", "slider", [10, 300, 100, 1]);
</script>
```
