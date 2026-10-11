import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from '../api/ApiClient'
import { App } from '../App'
import { apiClient, authSession, contentStore } from '../state/container'
import { makeProject } from '../test/fixtures'
import { LoginForm } from './LoginForm'
import { ProjectAdmin } from './ProjectAdmin'

afterEach(() => {
  vi.restoreAllMocks()
  authSession.clear()
  window.location.hash = ''
})

describe('App routing', () => {
  it('shows the login form at #/admin', async () => {
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(false)
    window.location.hash = '#/admin'

    render(<App />)

    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Projects' })).not.toBeInTheDocument()
  })
})

describe('LoginForm', () => {
  it('saves the token and reports success', async () => {
    vi.spyOn(apiClient, 'login').mockResolvedValue({ accessToken: 'tok', expiresIn: 1800 })
    const onSignedIn = vi.fn()
    render(<LoginForm onSignedIn={onSignedIn} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('tok'))
    expect(apiClient.login).toHaveBeenCalledWith('secret')
    expect(authSession.token).toBe('tok')
  })

  it('shows the API message when the password is wrong', async () => {
    vi.spyOn(apiClient, 'login').mockRejectedValue(new ApiError(401, 'Wrong password'))
    render(<LoginForm onSignedIn={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password')
    expect(authSession.token).toBeNull()
  })
})

describe('ProjectAdmin', () => {
  it('lists projects and creates a new one', async () => {
    const existing = makeProject({ id: 1, title: 'Existing' })
    const list = vi.spyOn(apiClient, 'listProjects').mockResolvedValue([existing])
    const create = vi.spyOn(apiClient, 'createProject').mockResolvedValue(makeProject({ id: 2 }))
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(true)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    expect(await screen.findByRole('cell', { name: 'Existing' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Route Agent' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('route-agent')
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'A tagline.' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A description.' } })
    fireEvent.change(screen.getByLabelText('Technologies'), { target: { value: 'Python\nuv' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    const [input, token] = create.mock.calls[0]
    expect(token).toBe('tok')
    expect(input).toMatchObject({
      slug: 'route-agent',
      title: 'Route Agent',
      tech: ['Python', 'uv'],
      status: 'prototype',
    })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('opens the editor filled in and saves an update', async () => {
    const existing = makeProject({ id: 7, title: 'Existing', slug: 'existing' })
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([existing])
    const update = vi.spyOn(apiClient, 'updateProject').mockResolvedValue(existing)
    vi.spyOn(contentStore, 'revalidate').mockResolvedValue(true)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    const row = (await screen.findByRole('cell', { name: 'Existing' })).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Slug')).toHaveValue('existing')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('existing')
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toBe(7)
    expect(update.mock.calls[0][1]).toMatchObject({ title: 'Renamed', slug: 'existing' })
  })

  it('signs out when the API rejects the token', async () => {
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([makeProject({ id: 1, title: 'Existing' })])
    vi.spyOn(apiClient, 'deleteProject').mockRejectedValue(new ApiError(401, 'Not authenticated'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onUnauthorised = vi.fn()
    render(<ProjectAdmin token="old" onUnauthorised={onUnauthorised} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onUnauthorised).toHaveBeenCalledTimes(1))
  })

  it('does not delete when the owner cancels the confirmation', async () => {
    vi.spyOn(apiClient, 'listProjects').mockResolvedValue([makeProject({ id: 1, title: 'Existing' })])
    const remove = vi.spyOn(apiClient, 'deleteProject').mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ProjectAdmin token="tok" onUnauthorised={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(remove).not.toHaveBeenCalled()
  })
})
