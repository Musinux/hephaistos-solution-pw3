<template>
  <v-row>
    <v-col cols="2" v-show="showPanel">
      <SessionExercisesEditor
        :session-id="sessionId"
        :exercise-id="exerciseId">
      </SessionExercisesEditor>
    </v-col>
    <v-col :cols="showPanel ? 10 : 12">
      <ExerciseEditor
        :exercise-id="exerciseId"
        :session-id="sessionId"
        @deleted="moveToPrevious"
        @toggle-panel="showPanel = !showPanel">
      </ExerciseEditor>
    </v-col>
  </v-row>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import ExerciseEditor from '../components/ExerciseEditor.vue'
import SessionExercisesEditor from '../components/SessionExercisesEditor.vue'

export default {
  components: {
    SessionExercisesEditor,
    ExerciseEditor
  },
  data: () => ({
    showPanel: true
  }),
  computed: {
    ...mapGetters('exercises', ['getExercisesBySessionId']),
    sessionId () {
      return parseInt(this.$route.params.sessionId)
    },
    exerciseId () {
      if (this.$route.params.exerciseId) {
        return parseInt(this.$route.params.exerciseId)
      } else {
        return null
      }
    }
  },
  methods: {
    ...mapActions('sessions', ['fetchSession', 'updateSession']),
    async moveToPrevious () {
      const exercises = this.getExercisesBySessionId(this.sessionId)
      this.$router.push(`/session/${this.sessionId}/edit/${exercises[0].id}`)
    }
  }
}
</script>
