import { FusionChat } from '@/features/fusion/FusionChat'

export function FusionChatPage(): JSX.Element {
  return (
    <main className="fusion-chat-page">
      <section className="fusion-chat-page-body fusion-chat-page-shell fusion-chat-native">
        <FusionChat />
      </section>
    </main>
  )
}
