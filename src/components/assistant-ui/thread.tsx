'use client'

import { ThreadPrimitive, ComposerPrimitive } from '@assistant-ui/react'
import type { ComponentType } from 'react'

const ThreadMessages = ThreadPrimitive.Messages as unknown as ComponentType

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-4">
          <ThreadMessages />
        </div>
        <ThreadPrimitive.Empty>
          <div className="text-center text-gray-500">Send a message to start chatting</div>
        </ThreadPrimitive.Empty>
      </ThreadPrimitive.Viewport>
      <ThreadPrimitive.ViewportFooter className="border-t p-4">
        <ComposerPrimitive.Root className="flex items-center gap-2">
          <ComposerPrimitive.Input
            className="flex-1 rounded-md border px-3 py-2"
            placeholder="Type your message..."
          />
          <ComposerPrimitive.Send className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
            Send
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Root>
  )
}
