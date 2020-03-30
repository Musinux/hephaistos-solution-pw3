<template>
  <v-card
    class="ma-2 exo"
    :height="height" :width="width" :tile="!current" outlined
    :class="{
      green: exercise.valid, 'darken-2': exercise.valid,
      grey: !exercise.valid, 'darken-3': !exercise.valid,
      'blue-border': current
    }"
    :style="{
      'border-color': current ? '#2196f3 !important' : 'inherit'
    }"
    >
    <div class="d-flex flex-no-wrap justify-space-between">
      <div>
        <v-card-title class="subtitle-1">
          <v-icon v-if="draggable" style="margin-right: 0.5em">mdi-drag-horizontal</v-icon>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <span v-on="on">{{ s(exercise.title) }}</span>
            </template>
            <span>{{ exercise.title }}</span>
          </v-tooltip>
        </v-card-title>
        <v-card-subtitle>{{ exercise.lang }}</v-card-subtitle>
      </div>
      <div>
        <v-card-text>
          <div class="d-flex flex-column flex-no-wrap justify-space-between">
            <div v-if="exercise.test_names">
              {{ exercise.test_names.length }}
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-icon v-on="on">mdi-poll-box</v-icon>
                </template>
                <span>Nombre de tests</span>
              </v-tooltip>
            </div>
            <div style="text-align: right; padding-top: 1em"
               v-if="hasAccessRight('module.edit')">
              <v-tooltip bottom >
                <template v-slot:activator="{ on }">
                  <router-link :to="`/session/${session.id}/edit/${exercise.id}`">
                    <v-icon v-on="on">mdi-pencil</v-icon>
                  </router-link>
                </template>
                <span>Éditer</span>
              </v-tooltip>
            </div>
            <div v-else style="text-align: right; padding-top: 1em">
              <v-tooltip bottom v-if="exercise.valid">
                <template v-slot:activator="{ on }">
                  <v-icon v-on="on">mdi-check</v-icon>
                </template>
                <span>Tests Validés</span>
              </v-tooltip>
            </div>
          </div>
        </v-card-text>
      </div>
    </div>
  </v-card>
</template>
<script>
import { mapGetters } from 'vuex'
export default {
  props: {
    current: {
      type: Boolean,
      default: false
    },
    draggable: {
      type: Boolean,
      default: false
    },
    exercise: Object,
    session: Object,
    height: {
      type: String,
      default: '8em'
    },
    width: {
      type: String,
      default: '16em'
    }
  },
  computed: {
    ...mapGetters('user', ['hasAccessRight'])
  },
  methods: {
    s (text) {
      const max = 17
      return text.length > max ? `${text.slice(0, max)}…` : text
    }
  }
}
</script>
<style lang="css">
.exo {
  border-radius: 8px;
}
</style>
