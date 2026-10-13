Engine state is created inside worker generation 1; worker writes journal and ACKs; parent forcibly terminates; generation 2 opens journal and reconstructs state. Parent never owns economic state.
