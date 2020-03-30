import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Module from '../views/Module.vue'
import DoExercise from '../views/DoExercise.vue'
import ExerciseEditorView from '../views/ExerciseEditorView.vue'
import store from '../store/index'

Vue.use(VueRouter)

async function beforeEnter (_to, _from, next) {
  if (!store.getters['user/isAuthenticated']) {
    await store.dispatch('user/fetchUser')
  }
  if (store.getters['user/isAuthenticated']) {
    next()
    return
  }
  next('/login')
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    beforeEnter
  },
  {
    path: '/module/:id',
    name: 'Module',
    component: Module,
    beforeEnter
  },
  {
    path: '/session/:sessionId/do/:exerciseId',
    name: 'DoExercise',
    component: DoExercise,
    beforeEnter
  },
  {
    path: '/session/:sessionId/edit/:exerciseId?',
    name: 'ExerciseEditor',
    component: ExerciseEditorView,
    beforeEnter
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  }
]

const router = new VueRouter({
  routes
})

export default router
