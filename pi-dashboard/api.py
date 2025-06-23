#!/usr/bin/env python3
"""
Simple Flask API for Pi power controls
Save as: /opt/dashboard/power_api.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import logging
import os
import time

app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_command(command):
    """Execute a system command safely"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=30
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status"""
    try:
        # Check if system is responsive
        success, uptime, error = run_command('uptime')
        if success:
            return jsonify({
                'status': 'online',
                'uptime': uptime.strip(),
                'timestamp': time.time()
            })
        else:
            return jsonify({
                'status': 'error',
                'error': error
            }), 500
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/power/shutdown', methods=['POST'])
def shutdown_system():
    """Shutdown the system"""
    try:
        logger.info("Shutdown request received")
        
        # Verify request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        if data.get('action') != 'shutdown':
            return jsonify({'error': 'Invalid action'}), 400
        
        # Log the shutdown
        logger.warning("System shutdown initiated via API")
        
        # Schedule shutdown in 10 seconds to allow response
        success, output, error = run_command('sudo shutdown -h +1 "System shutdown via dashboard"')
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Shutdown initiated',
                'countdown': 60  # 1 minute
            })
        else:
            logger.error(f"Shutdown failed: {error}")
            return jsonify({
                'status': 'error',
                'error': f'Shutdown command failed: {error}'
            }), 500
            
    except Exception as e:
        logger.error(f"Shutdown exception: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/power/reboot', methods=['POST'])
def reboot_system():
    """Reboot the system"""
    try:
        logger.info("Reboot request received")
        
        # Verify request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        if data.get('action') != 'reboot':
            return jsonify({'error': 'Invalid action'}), 400
        
        # Log the reboot
        logger.warning("System reboot initiated via API")
        
        # Schedule reboot in 1 minute to allow response
        success, output, error = run_command('sudo shutdown -r +1 "System reboot via dashboard"')
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Reboot initiated',
                'countdown': 60  # 1 minute
            })
        else:
            logger.error(f"Reboot failed: {error}")
            return jsonify({
                'status': 'error',
                'error': f'Reboot command failed: {error}'
            }), 500
            
    except Exception as e:
        logger.error(f"Reboot exception: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/system/info', methods=['GET'])
def get_system_info():
    """Get basic system information"""
    try:
        info = {}
        
        # Get uptime
        success, uptime, _ = run_command('uptime -p')
        if success:
            info['uptime'] = uptime.strip()
        
        # Get load average
        success, load, _ = run_command("cat /proc/loadavg | awk '{print $1, $2, $3}'")
        if success:
            info['load_average'] = load.strip()
        
        # Get memory info
        success, mem, _ = run_command("free -m | grep Mem | awk '{print $2, $3, $4}'")
        if success:
            mem_parts = mem.strip().split()
            if len(mem_parts) >= 3:
                info['memory'] = {
                    'total': int(mem_parts[0]),
                    'used': int(mem_parts[1]),
                    'free': int(mem_parts[2])
                }
        
        # Get temperature (Pi specific)
        success, temp, _ = run_command("vcgencmd measure_temp")
        if success and 'temp=' in temp:
            temp_val = temp.split('=')[1].replace("'C\n", "")
            info['temperature'] = float(temp_val)
        
        return jsonify(info)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Check if running as root (needed for shutdown commands)
    if os.geteuid() != 0:
        print("Warning: Not running as root. Shutdown/reboot commands may fail.")
    
    app.run(host='0.0.0.0', port=5000, debug=False)