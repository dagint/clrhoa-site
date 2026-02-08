/**
 * Client-side: init Chart.js for usage dashboard. Reads data from #usage-chart-data (JSON).
 */
import { Chart } from 'chart.js/auto';

interface ChartData {
  daily?: { date: string; views: number; uniqueSessions: number; uniqueUsers?: number }[];
  weekly?: { weekStart: string; views: number; uniqueSessions: number; uniqueUsers?: number }[];
  topPages?: { path: string; views: number; uniqueSessions: number }[];
}

function initCharts(data: ChartData) {
  const green = 'rgb(30, 95, 56)';
  const orange = 'rgb(194, 108, 43)';
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const } },
  };

  const daily = data.daily ?? [];
  const weekly = data.weekly ?? [];
  const topPages = data.topPages ?? [];

  if (daily.length) {
    const dailyEl = document.getElementById('chart-daily') as HTMLCanvasElement | null;
    if (dailyEl) {
      new Chart(dailyEl.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: daily.map((d) => d.date),
          datasets: [
            { label: 'Page views', data: daily.map((d) => d.views), backgroundColor: green, order: 1 },
            { label: 'Unique visitors', data: daily.map((d) => d.uniqueSessions), backgroundColor: orange, order: 2 },
          ],
        },
        options: { ...chartOptions, scales: { x: { ticks: { maxRotation: 45 } } } },
      });
    }
    // Line chart: active users + page views over time (same daily data)
    const activeEl = document.getElementById('chart-active-users') as HTMLCanvasElement | null;
    if (activeEl) {
      const dailyWithUsers = daily as { date: string; views: number; uniqueSessions: number; uniqueUsers?: number }[];
      const blue = 'rgb(59, 130, 246)';
      new Chart(activeEl.getContext('2d')!, {
        type: 'line',
        data: {
          labels: dailyWithUsers.map((d) => d.date),
          datasets: [
            { label: 'Page views', data: dailyWithUsers.map((d) => d.views), borderColor: green, backgroundColor: 'rgba(30, 95, 56, 0.1)', fill: false, tension: 0.2, order: 1 },
            { label: 'Unique visitors (sessions)', data: dailyWithUsers.map((d) => d.uniqueSessions), borderColor: orange, backgroundColor: 'rgba(194, 108, 43, 0.1)', fill: false, tension: 0.2, order: 2 },
            { label: 'Active users (logged in)', data: dailyWithUsers.map((d) => d.uniqueUsers ?? 0), borderColor: blue, backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.2, order: 3 },
          ],
        },
        options: {
          ...chartOptions,
          scales: {
            x: { ticks: { maxRotation: 45 } },
            y: { beginAtZero: true },
          },
        },
      });
    }
  }

  if (weekly.length) {
    const weeklyEl = document.getElementById('chart-weekly') as HTMLCanvasElement | null;
    if (weeklyEl) {
      new Chart(weeklyEl.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: weekly.map((w) => w.weekStart),
          datasets: [
            { label: 'Page views', data: weekly.map((w) => w.views), backgroundColor: green, order: 1 },
            { label: 'Unique visitors', data: weekly.map((w) => w.uniqueSessions), backgroundColor: orange, order: 2 },
          ],
        },
        options: { ...chartOptions, scales: { x: { ticks: { maxRotation: 45 } } } },
      });
    }
  }

  if (topPages.length) {
    const topEl = document.getElementById('chart-top-pages') as HTMLCanvasElement | null;
    if (topEl) {
      const labels = topPages.map((p) => (p.path.length > 40 ? p.path.slice(0, 37) + '...' : p.path));
      new Chart(topEl.getContext('2d')!, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Page views', data: topPages.map((p) => p.views), backgroundColor: green, order: 1 },
            { label: 'Unique visitors', data: topPages.map((p) => p.uniqueSessions), backgroundColor: orange, order: 2 },
          ],
        },
        options: { ...chartOptions, scales: { x: { ticks: { maxRotation: 45 } } } },
      });
    }
  }
}

function run() {
  const el = document.getElementById('usage-chart-data');
  const data: ChartData = el?.textContent ? JSON.parse(el.textContent) : {};
  initCharts(data);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run);
} else {
  run();
}
