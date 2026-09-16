'use client';
import { useState } from 'react';

export default function TestPage() {
  const [val, setVal] = useState('hello');
  return <div><p>{val}</p></div>;
}
