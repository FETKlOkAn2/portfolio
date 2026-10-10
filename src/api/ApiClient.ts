import { parseContent } from '../data/parseContent'
import type { Content, Project, ProjectInput } from '../domain/types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type ContentResult = { changed: false } | { changed: true; content: Content }

export interface LoginResult {
  accessToken: string
  expiresIn: number
}

/** The only place in the app that knows the API's URLs and wire format. */
export class ApiClient {
  private readonly baseUrl: string
  private readonly fetcher: typeof fetch

  constructor(baseUrl: string, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetcher = fetcher
  }

  async getContent(knownVersion?: string): Promise<ContentResult> {
    const headers: Record<string, string> = {}
    if (knownVersion) headers['If-None-Match'] = `"${knownVersion}"`
    const response = await this.fetcher(`${this.baseUrl}/api/v1/content`, { headers })
    if (response.status === 304) return { changed: false }
    if (!response.ok) throw new ApiError(response.status, 'Could not load content')
    return { changed: true, content: parseContent(await response.json()) }
  }

  login(password: string): Promise<LoginResult> {
    return this.send<LoginResult>('POST', '/api/v1/auth/login', { password })
  }

  listProjects(): Promise<Project[]> {
    return this.send<Project[]>('GET', '/api/v1/projects')
  }

  createProject(input: ProjectInput, token: string): Promise<Project> {
    return this.send<Project>('POST', '/api/v1/projects', input, token)
  }

  updateProject(id: number, input: ProjectInput, token: string): Promise<Project> {
    return this.send<Project>('PUT', `/api/v1/projects/${id}`, input, token)
  }

  async deleteProject(id: number, token: string): Promise<void> {
    await this.send<undefined>('DELETE', `/api/v1/projects/${id}`, undefined, token)
  }

  private async send<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new ApiError(response.status, await ApiClient.describe(response))
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  /** FastAPI sends `detail` as a string for HTTP errors and as a list for validation errors. */
  private static async describe(response: Response): Promise<string> {
    const fallback = `Request failed (${response.status})`
    let data: unknown
    try {
      data = await response.json()
    } catch {
      return fallback
    }
    if (typeof data !== 'object' || data === null || !('detail' in data)) return fallback
    const detail = data.detail
    if (typeof detail === 'string') return detail
    if (!Array.isArray(detail)) return fallback
    const messages = detail
      .map((item: unknown) =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string'
          ? item.msg
          : '',
      )
      .filter((message) => message !== '')
    return messages.length > 0 ? messages.join('; ') : fallback
  }
}
