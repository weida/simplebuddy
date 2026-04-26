The program implemented [Buddy memory allocation](https://en.wikipedia.org/wiki/Buddy_memory_allocation#cite_note-3) in the wiki

## C version

```bash
$ make
$ ./buddytest
```

## Web demo

The original C source files are kept in the repository root. A browser-based
demo is available in `web/`:

```bash
$ xdg-open web/index.html
```

You can also open `web/index.html` directly in a browser. The page demonstrates
the same 16-page, 64K-per-page buddy allocator flow used by `buddytest.c`.

After GitHub Pages is enabled for the repository root, the demo is available at:

```text
https://weida.github.io/simplebuddy/
```

```
     |2^4
 step| 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K | 64K |
 1   |2^4
 2   |2^4
     |2^3                                            |2^3
     |2^2                    |2^2                    |2^3
     |2^1        |2^1        |2^2                    |2^3
     |2^0  |2^0  |2^1        |2^2                    |2^3
 2   |A:2^0|2^0  |2^1        |2^2                    |2^3
 3   |A:2^0|2^0  |2^1        |2^2                    |2^3
 3   |A:2^0|2^0  |B:2^1      |2^2                    |2^3
 4   |A:2^0|2^0  |B:2^1      |2^2                    |2^3
 4   |A:2^0|C:2^0|B:2^1      |2^2                    |2^3
 5   |A:2^0|C:2^0|B:2^1      |2^2                    |2^3
     |A:2^0|C:2^0|B:2^1      |2^1        |2^1        |2^3
 5   |A:2^0|C:2^0|B:2^1      |D:2^1      |2^1        |2^3
 6   |A:2^0|C:2^0|B:2^1      |D:2^1      |2^1        |2^3
     |A:2^0|C:2^0|B:2^1      |D:2^1      |2^1        |2^3
 6   |A:2^0|C:2^0|2^1        |D:2^1      |2^1        |2^3
 7   |A:2^0|C:2^0|2^1        |D:2^1      |2^1        |2^3
     |A:2^0|C:2^0|2^1        |2^1        |2^1        |2^3
     |A:2^0|C:2^0|2^1        |2^2                    |2^3
 7   |A:2^0|C:2^0|2^1        |2^2                    |2^3
 8   |A:2^0|C:2^0|2^1        |2^2                    |2^3
     |2^0  |C:2^0|2^1        |2^2                    |2^3
 8   |2^0  |C:2^0|2^1        |2^2                    |2^3
 9   |2^0  |C:2^0|2^1        |2^2                    |2^3
     |2^0  |2^0  |2^1        |2^2                    |2^3
     |2^1        |2^1        |2^2                    |2^3
     |2^2                    |2^2                    |2^3
     |2^3                                            |2^3
     |2^4
 9   |2^4
```
