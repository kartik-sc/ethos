import uvicorn


def main() -> None:
    # log_config=None keeps uvicorn from replacing the JSON handlers set up in create_app.
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_config=None,
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
