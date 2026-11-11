"""Minimal ContextVar demo.

A ContextVar holds a value per asyncio Task, the way C# AsyncLocal<T>
holds one per async flow. Run it with:

    python context_vars_demo.py
"""

import asyncio
from collections.abc import Awaitable, Callable
from contextvars import ContextVar

request_id: ContextVar[str] = ContextVar("request_id", default="none")

# A plain module global is shared by every task. ContextVar replaces it.
global_request_id = "none"


async def handle_with_global(name: str) -> str:
    """Store the name in a global, wait for "I/O", then read it back."""
    global global_request_id
    global_request_id = name
    await asyncio.sleep(0.01)  # other tasks run here and overwrite it
    return global_request_id


async def handle_with_context_var(name: str) -> str:
    """Store the name in a ContextVar, wait for "I/O", then read it."""
    request_id.set(name)
    await asyncio.sleep(0.01)  # other tasks run here but see their own
    return request_id.get()


async def run_concurrently(
    handler: Callable[[str], Awaitable[str]], names: list[str]
) -> list[str]:
    """Run one handler task per name at the same time, like requests."""
    calls = [handler(name) for name in names]
    results = await asyncio.gather(*calls)
    return list(results)


async def child_changes_value() -> str:
    """Return the value the child sees, then overwrite it."""
    seen = request_id.get()
    request_id.set("changed-by-child")
    return seen


async def parent_starts_child_task() -> tuple[str, str]:
    """Start the child as a new Task: it runs on a copy of the context.

    Returns:
        The value the child saw, and the parent's value afterwards.
    """
    request_id.set("parent")
    child_task = asyncio.create_task(child_changes_value())
    child_saw = await child_task
    parent_sees = request_id.get()
    return child_saw, parent_sees


async def parent_awaits_coroutine() -> str:
    """Await the child directly: no new Task, so the context is shared.

    Returns:
        The parent's value after the child ran.
    """
    request_id.set("parent")
    await child_changes_value()
    parent_sees = request_id.get()
    return parent_sees


async def main() -> None:
    """Print each behaviour side by side."""
    names = ["A", "B", "C"]
    with_global = await run_concurrently(handle_with_global, names)
    with_context_var = await run_concurrently(
        handle_with_context_var, names
    )
    child_saw, parent_after_task = await parent_starts_child_task()
    parent_after_await = await parent_awaits_coroutine()

    print("1. Three concurrent tasks each set their own request id")
    print(f"   global     : sent {names} -> got {with_global}")
    print(f"   ContextVar : sent {names} -> got {with_context_var}")
    print("2. Parent starts a child Task, child changes the value")
    print(f"   child saw {child_saw!r}, parent still sees "
          f"{parent_after_task!r}  (copied down, never up)")
    print("3. Parent awaits the child coroutine directly (no new Task)")
    print(f"   parent now sees {parent_after_await!r}  (same context)")


if __name__ == "__main__":
    asyncio.run(main())
