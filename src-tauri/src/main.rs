#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--mcp") {
        bruin_lib::run_mcp();
    } else if args.iter().any(|a| a == "--install-skill") {
        bruin_lib::install_skill();
    } else if args.iter().any(|a| a == "--write-config") {
        bruin_lib::write_mcp_config();
    } else {
        bruin_lib::run();
    }
}
