<template>
  <v-card>
    <v-card-text>
      <v-row no-gutters v-show="!expandTests">
        <v-col class="pa-2 flex-grow-1">
          <v-row class="justify-space-between" no-gutters>
            <v-col cols="5">
              <v-row no-gutters>
                <v-col cols="1">
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-btn
                        v-on="on"
                        text
                        style="margin-top: 1em"
                        @click="togglePanel">
                        <v-icon v-show="showPanel">mdi-chevron-left</v-icon>
                        <v-icon v-show="!showPanel">mdi-chevron-right</v-icon>
                      </v-btn>
                    </template>
                    <span>Afficher/Masquer le panneau</span>
                  </v-tooltip>
                </v-col>
                <v-col cols="11">
                  <v-text-field
                    style="margin-left: 2em"
                    placeholder="Titre de l'exercice"
                    class="title-field"
                    label="Titre de l'exercice"
                    v-model="title"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-col>
            <v-col cols="4">
              <v-row class="pa-0 align-content-end flex-grow-0">
                <v-col cols="6">
                  <v-select :items="langChoices"
                    v-model="lang" @change="chooseMode">
                  </v-select>
                </v-col>
                <v-col cols="2">
                  <v-btn @click="save"
                    style="margin-top: 1em"
                    :color="exerciseColor"
                    :disabled="updatingExercise">
                    <v-icon v-if="exerciseColor === 'primary'">mdi-content-save</v-icon>
                    <v-icon v-else-if="exerciseColor === 'success'">mdi-check</v-icon>
                  </v-btn>
                </v-col>
                <v-col cols="2">
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-btn color="secondary" v-on="on" style="margin-top: 1em">
                        <router-link
                          :to="`/session/${sessionId}/do/${exerciseId}`"
                          style="color: white; text-decoration: none">
                          <v-icon>mdi-account-child</v-icon>
                        </router-link>
                      </v-btn>
                    </template>
                    <span>Passer à la vue étudiant</span>
                  </v-tooltip>
                </v-col>
              </v-row>
            </v-col>
          </v-row>
          <v-row no-gutters justify="space-between">
            <v-col cols="6">
              <h2 class="display-1">
                <v-icon class="big-icon">mdi-file</v-icon>
                Consignes
              </h2>
            </v-col>
            <v-col cols="1" style="text-align: right">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-btn text v-on="on" @click="showInstructions = !showInstructions">
                    <v-icon v-show="showInstructions">mdi-eye-off</v-icon>
                    <v-icon v-show="!showInstructions">mdi-eye</v-icon>
                  </v-btn>
                </template>
                <span>Afficher/Cacher les instructions</span>
              </v-tooltip>
            </v-col>
          </v-row>
          <InstructionsEditor
            v-show="showInstructions"
            :content="instructions"
            @change="setInstructions">
          </InstructionsEditor>
        </v-col>
      </v-row>

      <v-row no-gutters>
        <v-col md-6 class="pa-2 flex-grow-1" no-gutters>
          <v-row no-gutters justify="space-between">
            <v-col cols="6">
              <h2 class="display-1" style="padding-bottom: 0.5em">
                <v-icon class="big-icon">mdi-sigma</v-icon>
                Tests
              </h2>
            </v-col>
            <v-col cols="1" style="text-align: right">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-btn text v-on="on" @click="toggleExpandTests">
                    <v-icon v-show="!expandTests" class="big-icon">
                      mdi-fullscreen
                    </v-icon>
                    <v-icon v-show="expandTests" class="big-icon">
                      mdi-fullscreen-exit
                    </v-icon>
                  </v-btn>
                </template>
                <span>Étendre les tests</span>
              </v-tooltip>
            </v-col>
          </v-row>
          <CodeEditor name="tests" :lang="lang" :content="tests"
            :editor-height="codeEditorHeight"
            @change="setTests">
          </CodeEditor>
        </v-col>
        <v-col md-6 class="pa-2 flex-grow-1" no-gutters v-show="!expandTests">
          <h2 class="display-1" style="padding-bottom: 0">
            <v-icon class="big-icon">mdi-call-merge</v-icon>
            Template de résolution
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn color="primary" v-on="on" @click="sandboxExec">
                  <v-icon>mdi-play</v-icon>
                </v-btn>
              </template>
              <span>Lancer</span>
            </v-tooltip>
            <v-checkbox
              class="freeze-checkbox"
              v-model="freezeReadOnlyRanges"
              label="Figer les zones en lecture seule">
            </v-checkbox>
          </h2>

          <CodeEditor
            :specific-ranges="templateRegions"
            :editable-ranges="true"
            :freeze-read-only-ranges="freezeReadOnlyRanges"
            :editor-height="`40rem`"
            name="template" :lang="lang" :content="template"
            @change="setTemplate">
          </CodeEditor>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="6" class="pa-4">
          <h2 class="display-1">
            <v-icon class="big-icon">mdi-console</v-icon>
            Console
          </h2>
          <pre id="console">{{ consoleOutput }}</pre>
        </v-col>
        <v-col cols="6" class="pa-4">
          <h2 class="display-1">
            <v-icon class="big-icon">mdi-notification-clear-all</v-icon>
            Résultats des tests
          </h2>
          <TestResults :results="testsOutput"></TestResults>
        </v-col>
      </v-row>
    </v-card-text>
    <v-card-actions>
    </v-card-actions>
  </v-card>
</template>

<script>
import config from '../client.config'
import { mapGetters, mapActions } from 'vuex'
import InstructionsEditor from './InstructionsEditor.vue'
import CodeEditor from './CodeEditor.vue'
import TestResults from './TestResults.vue'

// const REGION_RW = 6 // 110b
const REGION_RO = 4 // 100b
const REGION_NOREAD = 0 // 000b

export default {
  components: {
    InstructionsEditor,
    CodeEditor,
    TestResults
  },
  data: () => ({
    codeEditorHeight: '40rem',
    showPanel: true,
    showInstructions: true,
    expandTests: false,
    exerciseColor: 'primary',
    updatingExercise: false,
    tests: '',
    template: '',
    template_regions: [],
    template_regions_rw: [],
    templateRegions: [],
    freezeReadOnlyRanges: false,
    title: '',
    instructions: '',
    lang: 'python',
    consoleOutput: 'No output.',
    errorConsoleOutput: 'No errors.',
    testsOutput: {},
    langChoices: [
      { text: 'Python', value: 'python' },
      { text: 'C', value: 'c' },
      { text: 'Javascript', value: 'javascript' }
    ],
    sessionId: 0,
    exerciseId: 0
  }),
  computed: {
    ...mapGetters('exercises', ['getExercisesBySessionId', 'getExerciseById']),
    ...mapGetters(['hasAccessRight']),
    canEditModule () {
      return this.hasAccessRight('module.edit')
    }
  },
  watch: {
    $route (to, from) {
      this.sessionId = to.params.sessionId
        ? parseInt(to.params.sessionId)
        : null
      this.exerciseId = parseInt(to.params.exerciseId)
      this.updateView()
    }
  },
  async mounted () {
    if (this.$route.params.exerciseId) {
      this.exerciseId = parseInt(this.$route.params.exerciseId)
    } else {
      this.exerciseId = null
    }
    this.sessionId = parseInt(this.$route.params.sessionId)
    await this.updateView()
  },
  methods: {
    ...mapActions('exercises', ['fetchExerciseForSession', 'createExerciseForSession',
      'updateExerciseForSession']),
    toggleExpandTests () {
      this.expandTests = !this.expandTests
      this.codeEditorHeight = this.expandTests ? '55rem' : '40rem'
      if (this.showPanel) {
        this.togglePanel()
      }
    },
    togglePanel () {
      this.showPanel = !this.showPanel
      this.$emit('toggle-panel')
    },
    async updateView () {
      if (this.exerciseId) {
        await this.fetchExerciseForSession({
          sessionId: this.sessionId,
          exerciseId: this.exerciseId
        })
      } else {
        this.exerciseId = await this.createExerciseForSession({
          sessionId: this.sessionId,
          exercise: null
        })
        this.$router.replace(`/session/${this.sessionId}/edit/${this.exerciseId}`)
      }

      const ex = this.getExerciseById(this.exerciseId)
      this.setDefaultValues(ex)
    },
    setDefaultValues (ex) {
      this.title = ex.title || ''
      this.instructions = ex.instructions || ''
      this.lang = ex.lang || 'python'
      this.tests = ex.tests || ''
      this.template = ex.template_regions.join('\n')

      this.convertDBRegionsToRanges(ex)
    },

    convertDBRegionsToRanges (ex) {
      if (ex.template_regions_rw) {
        this.templateRegions.length = 0
        let lastLine = 0
        const ro = []
        ex.template_regions.forEach((r, i) => {
          const lines = r.split('\n').length
          if (ex.template_regions_rw[i] === REGION_RO ||
            ex.template_regions_rw[i] === REGION_NOREAD) {
            ro.push({
              startRow: lastLine,
              endRow: lastLine + lines,
              state: ex.template_regions_rw[i]
            })
          }
          lastLine += lines
        })
        this.templateRegions.push(...ro)
      }
    },

    chooseMode (lang) {
      this.lang = lang
    },
    setInstructions (text) {
      this.instructions = text
    },
    setTests ({ text }) {
      this.tests = text
    },
    setTemplate ({ text, regions }) {
      this.template = text
      this.template_regions.length = 0
      this.template_regions_rw.length = 0
      this.templateRegions.length = 0
      this.template_regions.push(...regions.map(r => r.text))
      this.template_regions_rw.push(...regions.map(r => r.state))
      this.templateRegions.push(...regions
        .filter(r => r.state === REGION_RO || r.state === REGION_NOREAD))
    },
    async save () {
      try {
        this.updatingExercise = true
        await this.updateExerciseForSession({
          id: this.exerciseId,
          sessionId: this.sessionId,
          exercise: {
            instructions: this.instructions || '',
            lang: this.lang || 'python',
            title: this.title || '',
            tests: this.tests,
            template_regions: this.template_regions,
            template_regions_rw: this.template_regions_rw,
            difficulty: 5,
            score: 0
          }
        })
        this.updatingExercise = false
        this.exerciseColor = 'success'
        setTimeout(() => {
          this.exerciseColor = 'primary'
        }, 1000)
      } catch (err) {
        console.error('network error', err)
        this.exerciseColor = 'primary'
        throw err
      } finally {
        this.updatingExercise = false
      }
    },
    async sandboxExec () {
      try {
        const res = await this.$http.post(
          config.apiURL + '/exercise/sandbox',
          {
            lang: this.lang,
            tests: this.tests,
            solution: this.template
          }
        )
        /** @type {APIResult} */
        const data = res.data
        this.consoleOutput = data.stdout
        if (!this.consoleOutput) {
          this.consoleOutput = data.stderr
        }
        if (data.result) {
          data.result.tests.forEach(t => {
            t.expand = false
            if (t.failure) {
              t.failure.message = t.failure.message
                .replace(/([^\n\r\t ])[\n\r\t ]*$/, '$1')
            }
          })
          this.testsOutput = data.result
        } else {
          this.testsOutput = { tests: [] }
        }
      } catch (err) {
        console.error('network error', err)
      }
    }
  }
}
</script>
<style lang="css" scoped>
h1, h2 {
  padding-bottom: 1rem;
}

.container {
  width: 100%;
}

.title-field {
  margin-top: 1em;
}

.ghost {
  opacity: 0.4;
}

pre {
  white-space: pre-wrap;
}

.big-icon {
  margin-top: 0.1em;
  vertical-align: top;
  font-size: 2rem;
}

.freeze-checkbox {
  display: inline-block;
  margin-left: 1em;
  margin-top: 0;
}
</style>
