"use client"

import { useEffect, useState } from "react"

const FAVORITE_TASKS_STORAGE_KEY = "favorite-tasks"

export interface FavoriteTask {
  id: string
  title: string
  description: string
  category: string
  status: string
  reward: number
  applicants: number
  maxApplicants: number
  deadline: string | null
  featured: boolean
  skills: string[]
  employer: {
    displayName: string
    avatar: string
  }
}

function readFavorites(): FavoriteTask[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(FAVORITE_TASKS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFavorites(tasks: FavoriteTask[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FAVORITE_TASKS_STORAGE_KEY, JSON.stringify(tasks))
}

export function createFavoriteTask(task: any): FavoriteTask {
  return {
    id: String(task?.id ?? ""),
    title: String(task?.title ?? "Untitled task"),
    description: String(task?.description ?? ""),
    category: String(task?.category ?? "Uncategorized"),
    status: String(task?.status ?? "open"),
    reward: Number(task?.reward ?? task?.rewardAmount ?? 0),
    applicants: Number(task?.applicants ?? 0),
    maxApplicants: Number(task?.maxApplicants ?? 0),
    deadline: task?.deadline ? String(task.deadline) : null,
    featured: Boolean(task?.featured),
    skills: Array.isArray(task?.skills) ? task.skills.map((skill: unknown) => String(skill)) : [],
    employer: {
      displayName: String(task?.employer?.displayName ?? "Employer"),
      avatar: String(task?.employer?.avatar ?? ""),
    },
  }
}

export function useFavoriteTasks() {
  const [favoriteTasks, setFavoriteTasks] = useState<FavoriteTask[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setFavoriteTasks(readFavorites())
    setIsReady(true)
  }, [])

  const isFavorite = (taskId: string | number) =>
    favoriteTasks.some((task) => task.id === String(taskId))

  const toggleFavorite = (task: FavoriteTask) => {
    setFavoriteTasks((current) => {
      const exists = current.some((item) => item.id === task.id)
      const next = exists ? current.filter((item) => item.id !== task.id) : [task, ...current.filter((item) => item.id !== task.id)]
      writeFavorites(next)
      return next
    })
  }

  const removeFavorite = (taskId: string | number) => {
    setFavoriteTasks((current) => {
      const next = current.filter((task) => task.id !== String(taskId))
      writeFavorites(next)
      return next
    })
  }

  return {
    favoriteTasks,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    isReady,
  }
}
