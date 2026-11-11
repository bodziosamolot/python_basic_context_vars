"""Tests that pin down each ContextVar behaviour the demo prints."""

import asyncio

from context_vars_demo import (
    handle_with_context_var,
    handle_with_global,
    parent_awaits_coroutine,
    parent_starts_child_task,
    run_concurrently,
)

NAMES = ["A", "B", "C"]


def test_global_is_overwritten_by_concurrent_tasks():
    # Arrange
    handler = run_concurrently(handle_with_global, NAMES)

    # Act
    results = asyncio.run(handler)

    # Assert
    assert results == ["C", "C", "C"]


def test_context_var_keeps_each_tasks_own_value():
    # Arrange
    handler = run_concurrently(handle_with_context_var, NAMES)

    # Act
    results = asyncio.run(handler)

    # Assert
    assert results == NAMES


def test_child_task_starts_with_copy_of_parent_value():
    # Arrange
    scenario = parent_starts_child_task()

    # Act
    child_saw, _ = asyncio.run(scenario)

    # Assert
    assert child_saw == "parent"


def test_child_task_change_does_not_reach_parent():
    # Arrange
    scenario = parent_starts_child_task()

    # Act
    _, parent_sees = asyncio.run(scenario)

    # Assert
    assert parent_sees == "parent"


def test_directly_awaited_coroutine_shares_parent_context():
    # Arrange
    scenario = parent_awaits_coroutine()

    # Act
    parent_sees = asyncio.run(scenario)

    # Assert
    assert parent_sees == "changed-by-child"
