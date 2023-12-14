import Agenda from 'agenda';

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI as string } });

agenda.define('process voice request', async (job: any) => {
  console.log(job);
});

export const startAgenda = async () => {
  await agenda.start();
  console.log('Agenda started');
};

export const addJob = async (jobName: string, data: any) => {
  await agenda.schedule('now', jobName, data);
};

export default agenda;
