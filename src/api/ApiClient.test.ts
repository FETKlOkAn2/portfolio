// @vitest-environment node
import type { Mock } from 'vitest'
import { makeContent, makeProject } from '../test/fixtures'
import { ApiClient, ApiError } from './ApiClient'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clientAnswering(response: Response) {
  const fetcher: Mock<typeof fetch> = vi.fn(async () => response)
  return { client: new ApiClient('http://api.test/', fetcher), fetcher }
}

function sentHeaders(fetcher: Mock<typeof fetch>): Record<string, string> {
  return (fetcher.mock.calls[0][1]?.headers ?? {}) as Record<string, string>
}

describe('ApiClient.getContent', () => {
  it('returns parsed content on 200', async () => {
    const content = makeContent()
    const { client, fetcher } = clientAnswering(json(content))

    const result = await client.getContent()

    expect(result).toEqual({ changed: true, content })
    expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/v1/content')
    expect(sentHeaders(fetcher)['If-None-Match']).toBeUndefined()
  })

  it('sends the known version as an ETag and reports 304 as unchanged', async () => {
    const { client, fetcher } = clientAnswering(new Response(null, { status: 304 }))

    const result = await client.getContent('abc123')

    expect(result).toEqual({ changed: false })
    expect(sentHeaders(fetcher)['If-None-Match']).toBe('"abc123"')
  })

  it('throws ApiError on a server error', async () => {
    const { client } = clientAnswering(json({ detail: 'boom' }, 500))

    await expect(client.getContent()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  it('throws when the body is not a content payload', async () => {
    const { client } = clientAnswering(json({ hello: 'world' }))

    await expect(client.getContent()).rejects.toThrow('no version')
  })
})

describe('ApiClient admin calls', () => {
  it('posts the password as JSON and returns the token', async () => {
    const { client, fetcher } = clientAnswering(json({ accessToken: 't', expiresIn: 1800 }))

    const result = await client.login('secret')

    const init = fetcher.mock.calls[0][1]
    expect(result).toEqual({ accessToken: 't', expiresIn: 1800 })
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"password":"secret"}')
    expect(sentHeaders(fetcher)['Content-Type']).toBe('application/json')
  })

  it('surfaces the API detail message on failure', async () => {
    const { client } = clientAnswering(json({ detail: 'Wrong password' }, 401))

    const error = await client.login('nope').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect((error as ApiError).message).toBe('Wrong password')
  })

  it('joins validation messages from a 422', async () => {
    const detail = [{ msg: 'slug is invalid' }, { msg: 'title is required' }]
    const { client } = clientAnswering(json({ detail }, 422))

    await expect(client.createProject(makeProject(), 't')).rejects.toThrow(
      'slug is invalid; title is required',
    )
  })

  it('sends the bearer token on writes', async () => {
    const { client, fetcher } = clientAnswering(json(makeProject({ id: 9 })))

    await client.updateProject(9, makeProject(), 'tok')

    expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/v1/projects/9')
    expect(fetcher.mock.calls[0][1]?.method).toBe('PUT')
    expect(sentHeaders(fetcher).Authorization).toBe('Bearer tok')
  })

  it('resolves a 204 delete with no body', async () => {
    const { client } = clientAnswering(new Response(null, { status: 204 }))

    await expect(client.deleteProject(9, 'tok')).resolves.toBeUndefined()
  })
})
