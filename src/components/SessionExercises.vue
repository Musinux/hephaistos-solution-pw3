<template>
  <draggable
    v-model="sessionExercises"
    class="d-flex flex-wrap"
    :class="{ 'flex-column': column }"
    :group="{ name: 'exercises', pull: 'clone' }"
    ghost-class="ghost"
    :disabled="!draggable">
    <router-link v-for="exercise of getExercisesBySessionId(session.id)"
      :key="exercise.id"
      :to="`/session/${session.id}/do/${exercise.id}`"
      style="color: white; text-decoration: none">
      <ExerciseCard
        :exercise="exercise"
        :session="session"
        :height="exerciseHeight"
        :width="exerciseWidth"
        :draggable="draggable"
        :current="exercise.id === currentExerciseId"
        ></ExerciseCard>
    </router-link>
  </draggable>
</template>
<script>
import draggable from 'vuedraggable'
import ExerciseCard from '../components/ExerciseCard.vue'
import { mapGetters, mapActions } from 'vuex'

export default {
  components: {
    ExerciseCard,
    draggable
  },
  props: {
    draggable: {
      type: Boolean,
      default: false
    },
    session: Object,
    currentExerciseId: {
      type: Number,
      default: 0
    },
    column: {
      type: Boolean,
      default: false
    },
    exerciseHeight: {
      type: String,
      default: '8em'
    },
    exerciseWidth: {
      type: String,
      default: '16em'
    }
  },
  data: () => ({
  }),
  computed: {
    ...mapGetters('exercises', ['getExercisesBySessionId']),
    sessionExercises: {
      get () {
        return this.getExercisesBySessionId(this.session.id)
      },
      set (exercises) {
        const newExo = exercises.findIndex(e => e.sessionId !== this.session.id)
        if (newExo === -1) {
          this.updateExercisesSequence({ sessionId: this.session.id, exercises })
        } else {
          this.moveExerciseToSession({
            id: exercises[newExo].id,
            currentSessionId: exercises[newExo].sessionId,
            newSessionId: this.session.id,
            sequenceId: newExo + 1
          })
        }
      }
    }
  },
  methods: {
    ...mapActions('exercises', ['updateExercisesSequence', 'moveExerciseToSession'])
  }
}
</script>
<style lang="css" scoped>
.ghost {
  opacity: 0.4;
}
</style>
