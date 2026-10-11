import { ApiClient } from '../api/ApiClient'
import { parseContent } from '../data/parseContent'
import rawSnapshot from '../data/snapshot.json'
import { AuthSession } from './AuthSession'
import { ContentStore } from './ContentStore'

export const apiClient = new ApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:8000')
export const contentStore = new ContentStore(parseContent(rawSnapshot), apiClient)
export const authSession = new AuthSession(window.sessionStorage)
