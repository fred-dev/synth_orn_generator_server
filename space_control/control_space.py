from huggingface_hub import pause_space, restart_space, get_space_runtime, login
from dotenv import load_dotenv
from pathlib import Path
import time
import os
import sys

dotenv_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

login(os.getenv('HF_TOKEN'))
gradio_space = os.getenv('GRADIO_SPACE_PATH')

def sleep_space():
    pause_space(gradio_space)
    while True:
        space_status = get_space_runtime(gradio_space).stage
        print(space_status, file=sys.stderr)
        if space_status == 'PAUSED':
            break
        time.sleep(20)
    return space_status

def wake_space():
    restart_space(gradio_space)
    while True:
        space_status = get_space_runtime(gradio_space).stage
        print(space_status, file=sys.stderr)
        if space_status == 'RUNNING':
            break
        time.sleep(20)
    return space_status

def get_status():
    space_status = get_space_runtime(gradio_space).stage
    return space_status

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python control_space.py <command>")
        sys.exit(1)

    command = sys.argv[1]

    if command == "pause":
        result = sleep_space()
    elif command == "restart":
        result = wake_space()
    elif command == "status":
        result = get_status()
    else:
        print("Invalid command")
        sys.exit(1)

    print(result)
    sys.exit(0)
