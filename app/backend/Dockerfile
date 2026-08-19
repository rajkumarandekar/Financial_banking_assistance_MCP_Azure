# Use official Python image as base
FROM python:3.11-bullseye

# Set work directory
WORKDIR /app


# Install pipx and use it to install uv
RUN pip install --no-cache-dir pipx \
	&& pipx ensurepath \
	&& pipx install uv
ENV PATH="/root/.local/bin:$PATH"


# Install pinned dependencies from the lockfile (uv pip install -r pyproject.toml
# ignores uv.lock entirely and re-resolves against latest PyPI at build time -
# uv sync respects the lockfile, matching what's actually been tested)
COPY pyproject.toml ./
COPY uv.lock ./
RUN uv venv
RUN uv sync --active

# Copy application code
COPY app ./app

# Expose port
EXPOSE 8080

#un-comment/comment the CMD line below to enable/disable chatkit server integration. This will work using banking-web as frontend. Go to azure.yaml and make sure simple-chat frontend is commented out.
CMD [".venv/bin/uvicorn", "app.main_chatkit_server:app", "--host", "0.0.0.0", "--port", "8080"]

#un-comment/comment the CMD line below to enable/disable starting app with custom chat server implementation. This will require app/frontend/simple-chat as frontend. Go to azure.yaml and make sure banking-web frontend is commented out.
#CMD [".venv/bin/uvicorn", "app.main_handoff:app", "--host", "0.0.0.0", "--port", "8080"]