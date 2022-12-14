import SEOTags from '~/components/SEOTags';
import NotFoundPage from '~/components/404/NotFound';
import { parseChallengeSubmission } from '~/../shared/Challenge.shared';
import { FullScreenIDE } from '~/components/FullScreenIDE/FullScreenIDE';
import { ChallengeSubmissionI, ParsedChallengeSubmissionI } from '~/../shared/types/challengeSubmissions.types';

export default ({ challengeSubmission } : { challengeSubmission: ParsedChallengeSubmissionI }) => {
  if (challengeSubmission === undefined) {
    return <NotFoundPage />;
  }

  return (
    <>
      <SEOTags
        title="Full Screen Editor | TODO"
        url="TODO"
        description="TODO"
      />
      <FullScreenIDE challengeSubmission={challengeSubmission} />
    </>
  );
};

export async function getServerSideProps({ res, req }) {
  const CHALLENGE_ID = 'christmas-advent-2022';
  const SPAN = `[${CHALLENGE_ID}, getServerSideProps]`;

  const { default: fetch } = await import('node-fetch');
  const { default: appConfig } = await import('../../server/config');

  try {
    const { token } = req?.cookies ?? {};
    const resp = await fetch(`${appConfig.APP.endpoint}/challenge-submissions/${CHALLENGE_ID}`, {
      headers: {
        cookie: `token=${token}`,
      },
    });
    switch (resp.status) {
      case 200: {
        const challenge: ChallengeSubmissionI = await resp.json();
        const parsedChallenge = parseChallengeSubmission(challenge);
        return {
          props: { challengeSubmission: parsedChallenge },
        };
      }
      case 404:
        return redirect404(res);
      default:
        throw resp;
    }
  } catch (err) {
    console.error(`${SPAN} got while fetching challenge.`, err);
    return redirect404(res);
  }

  function redirect404(res) {
    res.statusCode = 404;
    return {
      props: {},
    };
  }
}
