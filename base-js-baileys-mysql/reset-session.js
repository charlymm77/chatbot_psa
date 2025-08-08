#!/usr/bin/env node

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const sessionPath = join(process.cwd(), 'bot_sessions');

if (existsSync(sessionPath)) {
  try {
    rmSync(sessionPath, { recursive: true, force: true });
    console.log('✅ Sesión eliminada correctamente.');
    console.log('🔄 Reinicia el bot para generar un nuevo código QR.');
  } catch (error) {
    console.error('❌ Error al eliminar la sesión:', error.message);
  }
} else {
  console.log('ℹ️  No hay sesión que eliminar.');
}