import re
from typing import Any

from chatkit.actions import ActionConfig
from chatkit.widgets import Box, Button, Card, Col, Divider, Icon, Row, Text, Title, WidgetRoot

# Fields that are internal/technical plumbing, never useful for a customer to
# see in a confirmation prompt (auth identity, blobs, framework bookkeeping).
_HIDDEN_FIELDS = {
    "callerCustomerId", "callerRole", "customerId", "customer_id",
    "attachmentBase64", "call_id", "request_id",
}

# tool_name -> (friendly title, icon, icon/button color token, icon background)
# icon color must be one of: prose/primary/emphasis/secondary/tertiary/success/warning/danger
# background must be a surface-* token or a primitive color scale like green-100
_TOOL_PRESENTATION: dict[str, tuple[str, str, str, str]] = {
    "processPayment": ("Confirm Payment", "check-circle", "success", "green-100"),
    "sendEmail": ("Confirm Email", "mail", "primary", "blue-100"),
    "sendWhatsapp": ("Confirm WhatsApp Message", "phone", "primary", "blue-100"),
    "sendNotification": ("Confirm Notification", "bolt", "primary", "blue-100"),
    "applyLoan": ("Confirm Loan Application", "document", "warning", "amber-100"),
    "approveLoan": ("Confirm Loan Approval", "check-circle", "success", "green-100"),
    "rejectLoan": ("Confirm Loan Rejection", "circle-question", "danger", "red-100"),
    "buyStock": ("Confirm Stock Purchase", "chart", "warning", "amber-100"),
    "sellStock": ("Confirm Stock Sale", "chart", "warning", "amber-100"),
}
_DEFAULT_ICON_COLOR = "primary"
_DEFAULT_ICON_BG = "blue-100"


def _humanize_field_name(key: str) -> str:
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", key).replace("_", " ")
    return spaced.strip().title()


def _humanize_tool_name(tool_name: str) -> str:
    spaced = re.sub(r"(?<!^)(?=[A-Z])", " ", tool_name).replace("_", " ")
    return f"Confirm {spaced.strip().title()}"


def _format_value(key: str, value: Any) -> str:
    if isinstance(value, (int, float)) and "amount" in key.lower():
        return f"₹{value:,.2f}" if isinstance(value, float) else f"₹{value:,}"
    if value is None or value == "":
        return "—"
    return str(value)


def build_approval_request(tool_name: str, tool_args: dict[str, Any] | None, call_id: str, request_id: str) -> WidgetRoot:
    """Build a human-readable approval request widget for tool execution."""
    title, icon_name, icon_color, icon_bg = _TOOL_PRESENTATION.get(
        tool_name, (_humanize_tool_name(tool_name), "info", _DEFAULT_ICON_COLOR, _DEFAULT_ICON_BG)
    )

    detail_rows: list[Row] = []
    for key, value in (tool_args or {}).items():
        if key in _HIDDEN_FIELDS:
            continue
        detail_rows.append(
            Row(
                justify="between",
                gap=3,
                children=[
                    Text(value=_humanize_field_name(key), color="secondary", size="sm"),
                    Text(value=_format_value(key, value), weight="medium", size="sm"),
                ],
            )
        )

    return Card(
        key="approval_request",
        padding=0,
        size="md",
        children=[
            Col(
                align="center",
                gap=3,
                padding=4,
                children=[
                    Box(
                        background=icon_bg,
                        radius="full",
                        padding=3,
                        children=[Icon(name=icon_name, size="lg", color=icon_color)],
                    ),
                    Col(
                        align="center",
                        gap=1,
                        children=[
                            Title(value=title),
                            Text(value="Please review the details below before continuing.", color="secondary", size="sm"),
                        ],
                    ),
                ],
            ),
            Col(gap=2, padding={"x": 4, "bottom": 3}, children=detail_rows) if detail_rows else Box(),
            Divider(spacing=0),
            Row(
                gap=2,
                padding=3,
                children=[
                    Button(
                        label="Cancel",
                        block=True,
                        variant="outline",
                        onClickAction=ActionConfig(
                            type="approval",
                            payload={"tool_name": tool_name, "tool_args": tool_args, "approved": False, "call_id": call_id, "request_id": request_id},
                        ),
                    ),
                    Button(
                        label="Approve",
                        block=True,
                        color=icon_color,
                        onClickAction=ActionConfig(
                            type="approval",
                            payload={"tool_name": tool_name, "tool_args": tool_args, "approved": True, "call_id": call_id, "request_id": request_id},
                        ),
                    ),
                ],
            ),
        ],
    )
