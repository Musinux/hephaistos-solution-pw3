<template>
  <div :id="'editor-' + name"
    class="exercise-editor-ace-editor"
    :style='{ height: editorHeight }'>
  </div>
</template>

<script>
import ace from 'ace-builds/src-noconflict/ace'
import 'ace-builds/src-noconflict/theme-monokai'
import 'ace-builds/src-noconflict/mode-python'
import 'ace-builds/src-noconflict/mode-javascript'
import 'ace-builds/src-noconflict/mode-c_cpp'
import 'ace-builds/webpack-resolver'
const REGION_RW = 6 // 110b
const REGION_RO = 4 // 100b
const REGION_NOREAD = 0 // 100b
const BREAKPOINT_RO = 'readonly-breakpoint'
const BREAKPOINT_NOREAD = 'hide-in-template-breakpoint'
const HIGHLIGHT_RO = 'readonly-highlight'
const HIGHLIGHT_NOREAD = 'hide-in-template-highlight'
const KEY_ENTER = 13
const KEY_DOWN_ARROW = 40
const KEY_LEFT_ARROW = 37

function intersects (editor, range) {
  return editor.getSelectionRange().intersects(range)
}

/**
 * This function creates a custom wrapper for internal functions of ace
 * it calls our function first and gives the original function as a parameter
 * of the new function ( () => orig(args) )
 * it rebinds our function to the 'this' of the editor instead of its previous scope
 */
function before (editor, ranges, method, wrapper) {
  const orig = editor[method].bind(editor)
  wrapper = wrapper.bind(editor)
  editor[method] = (...args) => wrapper(editor, ranges, () => orig(args))
}

/**
 * this is the function that is rebound to the editor
 * see the 'next' argument which will call () => orig(args)
 */
function preventReadonly (editor, ranges, next) {
  for (let i = 0; i < ranges.length; i++) {
    if (intersects(editor, ranges[i])) return
  }
  next()
}

export default {
  props: {
    lang: String,
    /**
     * this is needed to make the id of the editor unique
    */
    name: String,
    /**
     * the user text (code)
     */
    content: String,
    /**
     * This is an array of ranges
     * a range contains: {
     *   startRow: Number,
     *   endRow: Number, // the last line of the range + 1
     *   state: Number (the read-write value)
     * }
     * see 'ExerciseEditor.convertDBRegionsToRanges()' for the function that
     * converts server-side 'template_regions' to specificRanges
     */
    specificRanges: {
      type: Array,
      required: false
    },
    /**
     * Allow the teacher to click on the breapoint column to add/remove
     * ranges as needed
     */
    editableRanges: {
      type: Boolean,
      default: false
    },
    /**
     * Make the teacher able to edit the "read-only" range content
     * this will make the ranges resizable and evolve with the content
     * this is only for the "text input" part (type with the keyboard)
    */
    freezeReadOnlyRanges: {
      type: Boolean,
      default: true
    },
    editorHeight: {
      type: String,
      default: '20rem'
    }
  },
  data: () => ({
    lastClickedRow: -1,
    resetLastClickedRow: null,
    editor: null,
    contentJustChanged: false,
    ranges: [],
    readonlyHandlerSet: false
  }),
  watch: {
    /**
     * lastClickedRow will watch for the breakpoint line
     * it's used to switch between reaonly, readwrite or hidden state
     * one click and it's readonly, 2 clicks and it's hidden
     */
    lastClickedRow (newVal) {
      if (newVal === -1) return
      if (this.resetLastClickedRow) {
        clearInterval(this.resetLastClickedRow)
        this.resetLastClickedRow = null
      }
      this.resetLastClickedRow = setTimeout(() => {
        this.lastClickedRow = -1
        this.resetLastClickedRow = null
      }, 2000)
    },
    editorHeight () {
      this.editor.resize()
    },
    /**
     * If we receive new content from the parent component,
     * we need to update the text with setValue()
     */
    content (newVal) {
      if (this.editor && newVal !== this.editor.getValue()) {
        this.contentJustChanged = true
        this.editor.setValue(newVal)
        this.editor.clearSelection()
      }
    },
    /**
     * If the parent component sent new ranges, we need to update the highlighting
     */
    specificRanges (newVal) {
      if (this.editor) {
        this.configureACEForReadOnlyRanges(newVal)
      }
    },
    lang (newVal) {
      if (this.editor) {
        this.changeLang(newVal)
      }
    }
  },
  mounted () {
    this.editor = ace.edit('editor-' + this.name)
    this.editor.setTheme('ace/theme/monokai')
    this.editor.setFontSize('1.1rem')
    this.changeLang(this.lang)

    // listen for the 'change' event of the editor
    // used when the user types with the keyboard or c/c
    this.editor.session.on('change', (e) => {
      // avoid recoil when using setContent(newVal)
      if (!this.contentJustChanged) {
        this.onChange(e)
      } else {
        this.contentJustChanged = false
      }
    })
    // we start with user-defined content
    // we need to clearSelection() because
    // setValue() automatically sets the text to selected (highlighted)
    if (this.content) {
      this.editor.setValue(this.content)
      this.editor.clearSelection()
    }
    // we only trigger the Readonly handling if specificRanges is defined
    if (this.specificRanges) {
      this.configureACEForReadOnlyRanges(this.specificRanges)
    }
  },
  beforeDestroy () {
    if (this.editor) {
      this.editor.destroy()
      this.editor.container.remove()
    }
  },
  methods: {
    changeLang (lang) {
      if (typeof lang === 'undefined') {
        lang = 'python'
      } else if (lang === 'c') {
        lang = 'c_cpp'
      }
      this.editor.session.setMode(`ace/mode/${lang}`)
      if (lang === 'javascript') {
        // this is to disable ';' lint errors when working with JS
        this.editor.session.$worker.send('changeOptions', [{ asi: true }])
      }
    },
    /**
     * The goal of this function is to send the current state of the editor
     * to the parent component in order to keep track and save the new regions
     */
    onChange (event, force = false) {
      const text = this.editor.getValue()
      // we don't update the view if the content didn't change
      // but sometimes we need to, so we force it (when using the brekpoints clicks)
      if (!force && text === this.content) return
      // read only regions
      const specificRegions = this.ranges
      const regions = []
      const byLine = text.split('\n')

      // if specificRegions is empty, we don't have to manage access rights
      // so we only add a big REGION_RW
      if (!specificRegions.length) {
        regions.push({
          state: REGION_RW,
          startRow: 1,
          endRow: byLine.length + 1,
          text
        })
      } else {
        let lastEnd = 0
        // we always send the boundaries of the regions + the slice of the
        // text to be consistent accross all the app
        // we don't record REGION_RW in the specificRegions, so
        // to to know that we are in it, we check wether the current row is higher
        // than the last regions' end
        specificRegions.forEach((r, i) => {
          if (r.start.row > lastEnd) {
            regions.push({
              state: REGION_RW,
              startRow: lastEnd,
              endRow: r.start.row,
              text: byLine.slice(lastEnd, r.start.row).join('\n')
            })
          }
          regions.push({
            state: r.state,
            startRow: r.start.row,
            endRow: r.end.row,
            text: byLine.slice(r.start.row, r.end.row).join('\n')
          })
          lastEnd = r.end.row
        })

        if (byLine.length > lastEnd) {
          regions.push({
            state: REGION_RW,
            startRow: lastEnd + 1,
            endRow: byLine.length + 1,
            text: byLine.slice(lastEnd).join('\n')
          })
        }
      }

      // we send the text + the regions to the parent component
      this.$emit('change', { text, regions })
    },

    /**
     * this function replaces built-in functions from ACE with
     * our custom ones that will allow or not to edit some parts
     * depending on where the symbols are typed
     */
    configureACEForReadOnlyRanges (specificRanges) {
      const editor = this.editor
      const ranges = this.ranges
      const session = editor.getSession()

      // first, clear current readonly ranges
      this.clearMarkers()
      this.addMarkers(specificRanges)

      // if we already defined the keyboardHandler, don't do this
      // action twice
      if (this.readonlyHandlerSet) return
      this.readonlyHandlerSet = true

      if (this.editableRanges) {
        this.makeReadOnlyRangesEditable()
      }

      this.setKeyboardHandler()

      before(editor, ranges, 'onPaste', preventReadonly)
      before(editor, ranges, 'onCut', preventReadonly)

      ranges.forEach(r => {
        r.start = session.doc.createAnchor(r.start)
        r.end = session.doc.createAnchor(r.end)
        r.end.$insertRight = true
      })

      const _tryReplace = editor.$tryReplace.bind(editor)
      const _insert = session.insert.bind(session)
      const _remove = session.remove.bind(session)
      const _moveText = session.moveText.bind(session)
      editor.$tryReplace = tryReplace
      session.insert = insert
      session.remove = remove
      session.moveText = moveText

      // we want our own functions to be able to use the 'this' keyword
      // so we bind() them to the current scope (this)
      const intersectsRange = this.intersectsRange.bind(this)
      const outsideRange = this.outsideRange.bind(this)
      const moveLowerRanges = this.moveLowerRanges.bind(this)
      const areReadOnlyRangesFrozen = () => this.freezeReadOnlyRanges
      // const editReadOnlyRange = this.editReadOnlyRange.bind(this)

      function tryReplace (range, replacement, ...rest) {
        if (intersectsRange(range)) {
          if (areReadOnlyRangesFrozen()) return null
          // else editReadOnlyRange()
        }
        return _tryReplace(range, replacement, ...rest)
      }

      function insert (position, text) {
        if (areReadOnlyRangesFrozen()) {
          text = outsideRange(position) ? text : ''
        }
        return _insert(position, text)
      }

      function remove (range, ...rest) {
        if (areReadOnlyRangesFrozen() && intersectsRange(range)) return false
        const diff = range.end.row - range.start.row

        if (diff !== 0) {
          moveLowerRanges(editor.getCursorPosition(), -diff)
        }
        return _remove(range, ...rest)
      }

      function moveText (fromRange, toPosition, copy, ...rest) {
        if (areReadOnlyRangesFrozen() &&
          (intersectsRange(fromRange) || !outsideRange(toPosition))) {
          return fromRange
        }
        return _moveText(fromRange, toPosition, copy, ...rest)
      }
    },

    /**
     * simple function that checks whether the range
     */
    intersectsRange (newRange) {
      const found = this.ranges.findIndex(r => newRange.intersects(r))
      return found >= 0
    },

    /**
     * converts the range object to the parameters given to new Range()
     */
    toRange ({ startRow, startColumn = 0, endRow, endColumn = 0 }) {
      return [startRow, startColumn, endRow, endColumn]
    },

    /**
     * checks if the appended symbol is in a specific range or not
     */
    outsideRange ({ row, column }) {
      for (const r of this.ranges) {
        if (r.start.row <= row && r.end.row > row) {
          return false
        }
        if (r.start.row === row && r.start.column <= column) {
          if (r.end.row !== row || r.end.column >= column) {
            return false
          }
        } else if (r.end.row === row && r.end.column > column) {
          return false
        }
      }
      return true
    },

    /**
     * clears every range from the editor
     */
    clearMarkers () {
      this.editor.session.clearBreakpoints()
      if (this.ranges) {
        this.ranges.forEach(r => this.editor.session.removeMarker(r.id))
        this.ranges.length = 0
      }
    },

    removeBreakpointsForMarker (session, range) {
      for (let row = range.start.row; row < range.end.row; row++) {
        session.clearBreakpoint(row)
      }
    },

    addBreakpointsForMarker (session, range) {
      for (let row = range.start.row; row < range.end.row; row++) {
        session.setBreakpoint(row,
          range.state === REGION_RO ? BREAKPOINT_RO : BREAKPOINT_NOREAD)
      }
    },

    addMarkers (specificRanges) {
      const { Range } = ace.require('ace/range')
      for (let i = 0; i < specificRanges.length; i++) {
        const range = new Range(...(this.toRange(specificRanges[i])))
        range.state = specificRanges[i].state
        this.ranges.push(range)
        this.addBreakpointsForMarker(this.editor.session, range)
        this.addMarker(this.editor, range)
      }
    },

    /**
     * check if we are on the end of a range
     * used to determine whether we need to block input or not
     */
    onEnd ({ row, column }) {
      const found = this.ranges
        .findIndex(r => r.end.row === row && r.end.column === column)
      return found !== -1
    },

    /**
     * if the user presses enter, we must move ranges
     */
    moveLowerRanges ({ row, column }, lineCount) {
      const found = this.ranges.filter(r => r.start.row > row || r.end.row > row)
      found.forEach(r => {
        this.removeBreakpointsForMarker(this.editor.session, r)
        if (r.start.row > row) r.start.row += lineCount
        if (r.end.row > row) r.end.row += lineCount
        if (r.start.row === r.end.row) {
          this.removeRange(this.editor, this.ranges, r)
        }
        this.addBreakpointsForMarker(this.editor.session, r)
      })
    },

    currentSelectionHasIntersection () {
      for (let i = 0; i < this.ranges.length; i++) {
        if (intersects(this.editor, this.ranges[i])) {
          return true
        }
      }
      return false
    },

    handleKeyboardCallback (data, hash, keyString, keyCode, event) {
      if (Math.abs(keyCode) === KEY_ENTER) {
        // if we are on the edge of a range, we allow pressing enter
        // but if we are not on an edge and in the current selection,
        // disable it
        if (this.onEnd(this.editor.getCursorPosition()) ||
          !this.currentSelectionHasIntersection()) {
          this.moveLowerRanges(this.editor.getCursorPosition(), 1)
          return false
        }

        if (!this.freezeReadOnlyRanges) {
          this.moveLowerRanges(this.editor.getCursorPosition(), 1)
          return false
        }
      }

      if (hash === -1 || (keyCode >= KEY_LEFT_ARROW && keyCode <= KEY_DOWN_ARROW)) {
        return false
      }

      if (this.currentSelectionHasIntersection()) {
        if (!this.freezeReadOnlyRanges) {
          return false
        }
        return { command: 'null', passEvent: false }
      }
    },

    setKeyboardHandler () {
      this.editor.keyBinding.addKeyboardHandler({
        handleKeyboard: this.handleKeyboardCallback.bind(this)
      })
      this.readonlyHandlerSet = true
    },

    addMarker (editor, range) {
      let css
      switch (range.state) {
        case REGION_RO:
          css = HIGHLIGHT_RO
          break
        case REGION_NOREAD:
          css = HIGHLIGHT_NOREAD
          break
      }
      // we save the id of the range to delete it afterwards if needed
      range.id = editor.session.addMarker(range, css)
    },

    /**
     * When the teacher adds or removes a line,
     * we need to decide what to do. Either remove a line
     * of a range, or make it wider, or create a new range
     */
    shrinkReadOnlyZones (editor, ranges, row) {
      const range = ranges.find(r =>
        r.start.row <= row && row < r.end.row
      )

      if (range.end.row === row + 1) {
        range.end.row -= 1
        if (range.end.row === range.start.row) {
          this.removeRange(editor, ranges, range)
        }
      } else if (range.start.row === row) {
        range.start.row += 1
        if (range.end.row === range.start.row) {
          this.removeRange(editor, ranges, range)
        }
      } else {
        // split the zone in two
        const end = range.end.row
        range.end.row = row
        this.insertRange(editor, ranges, row + 1, end, range.state)
      }
    },

    insertRange (editor, ranges, startRow, endRow, state) {
      const { Range } = ace.require('ace/range')
      const range = new Range(startRow, 0, endRow, 0)
      range.state = state
      this.addMarker(editor, range)
      // ranges have to be ordered to simplify filtering
      const closest = ranges.findIndex(r => r.start.row > startRow)
      if (closest === -1) {
        ranges.push(range)
      } else {
        ranges.splice(closest, 0, range)
      }
    },

    removeRange (editor, ranges, range) {
      editor.session.removeMarker(range.id)
      const index = ranges.findIndex(r => r.id === range.id)
      ranges.splice(index, 1)
    },

    extendReadOnlyZones (editor, ranges, row) {
      const concernedRanges = ranges.filter(r =>
        r.start.row === row + 1 || r.end.row === row
      )

      // overlapping case
      if (concernedRanges.length === 2) {
        const toRm = concernedRanges[1]
        const toExtend = concernedRanges[0]
        toExtend.end.row = toRm.end.row
        this.removeRange(editor, ranges, toRm)
        return
      }

      // extending case
      if (concernedRanges.length === 1) {
        const toExtend = concernedRanges[0]
        if (toExtend.start.row === row + 1) {
          toExtend.start.row -= 1
        } else {
          toExtend.end.row += 1
        }
        return
      }

      // there were no range there
      this.insertRange(editor, ranges, row, row + 1, REGION_RO)
    },

    /**
     * Here is defined the code to handle click on left zones
     * Its goal is to define ranges that are either readonly or kept as
     * information to the user
     */
    makeReadOnlyRangesEditable () {
      const ranges = this.ranges
      this.editor.on('guttermousedown', (e) => {
        const target = e.domEvent.target

        if (target.className.indexOf('ace_gutter-cell') === -1 ||
            !e.editor.isFocused() ||
            e.clientX > 25 + target.getBoundingClientRect().left) {
          return
        }

        const { row } = e.getDocumentPosition()
        const breakpoints = e.editor.session.getBreakpoints()

        // If there's a breakpoint already defined,
        // it should be removed, offering the toggle feature
        if (typeof breakpoints[row] === 'undefined') {
          this.lastClickedRow = row
          this.extendReadOnlyZones(e.editor, ranges, row)
          e.editor.session.setBreakpoint(row, REGION_RO)
        } else {
          if (this.lastClickedRow === row) {
            this.lastClickedRow = row
            this.toggleRange(row)
          } else {
            this.lastClickedRow = -1
            this.shrinkReadOnlyZones(e.editor, ranges, row)
            e.editor.session.clearBreakpoint(row)
          }
        }
        this.onChange({}, true) // force
      })
    },

    /**
     * we have multiple types of ranges, this function
     * has the goal to toggle the type of the range depending on
     * its current type
     */
    toggleRange (row) {
      const range = this.ranges.find(r => r.start.row <= row && row < r.end.row)
      range.state = range.state === REGION_RO ? REGION_NOREAD : REGION_RO
      this.editor.session.removeMarker(range.id)
      this.addMarker(this.editor, range)
    }
  }
}
</script>

<style lang="css">
.exercise-editor-ace-editor {
  position: relative;
}

.readonly-highlight {
  background-color: green;
  opacity: 0.2;
  position: absolute;
}

.hide-in-template-highlight {
  background-color: #2196f3;
  opacity: 0.2;
  position: absolute;
}

/*  .ace_active-line
      background-color red
      opacity 0.4
*/

.ace_gutter-cell.readonly-breakpoint {
  background-color: green;
  opacity: 0.4;
  color: black;
}

.ace_gutter-cell.hide-in-template-breakpoint {
  background-color: #2196f3;
  opacity: 0.4;
  color: black;
}
</style>
