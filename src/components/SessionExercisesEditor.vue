<template>
  <v-row class="flex-column">
    <h1 class="pa-2">
      <v-row>
        <v-col cols="9">
          <span style="margin-left: 0.5em">{{ sessionName }}</span>
        </v-col>
      </v-row>
    </h1>
    <v-checkbox
      style="margin-left: 1em; margin-top: 0"
      v-model="editExercisesPositions"
      label="Réordonner les exercices">
    </v-checkbox>
    <router-link :to="`/session/${sessionId}/edit`"
      style="color: white; text-decoration: none">
      <v-card class="ma-2 exo"
        height="4rem" tile outlined color="primary">
        <v-card-title class="subtitle-1">
          <v-icon>mdi-plus-box</v-icon>
          <span style="margin-left: 0.5em">Ajouter un exercice</span>
        </v-card-title>
      </v-card>
    </router-link>
    <SessionExercises
      :draggable="editExercisesPositions"
      :session="getSessionById(sessionId) || { id: -1 }"
      :current-exercise-id="exerciseId"
      :column="true"
      exercise-height="6rem"
      :exercise-width="null">
    </SessionExercises>
  </v-row>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import SessionExercises from '../components/SessionExercises.vue'

export default {
  components: {
    SessionExercises
  },
  props: {
    sessionId: Number,
    exerciseId: Number
  },
  data: () => ({
    editExercisesPositions: false
  }),
  computed: {
    ...mapGetters('sessions', ['getSessionById']),
    ...mapGetters('exercises', ['getExercisesBySessionId']),
    sessionName () {
      const sess = this.getSessionById(this.sessionId)
      if (sess) return sess.name
      return 'Loading...'
    }
  },
  watch: {
    exerciseId (newVal) {
      this.updateView()
    }
  },
  async mounted () {
    await this.updateView()
  },
  methods: {
    ...mapActions('sessions', ['fetchSession', 'updateSession']),
    ...mapActions('exercises', ['fetchExercisesForSession', 'updateExercisesSequence']),
    async updateView () {
      if (!this.getExercisesBySessionId(this.sessionId).length) {
        await Promise.all([
          this.fetchSession({ id: this.sessionId }),
          this.fetchExercisesForSession({ sessionId: this.sessionId })
        ])
      }
    }
  }
}
</script>
<style lang="css" scoped>
h1 {
  padding-bottom: 1rem;
}

.ghost {
  opacity: 0.4;
}
</style>
