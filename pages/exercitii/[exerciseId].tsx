import NotFoundPage from '../404';
import Footer from '~/components/Footer';
import Header from '~/components/Header';
import SEOTags from '~/components/SEOTags';
import { Exercise } from '~/redux/user/types';
import { ViewOrEditExercise } from '~/components/create-view-edit-exercise';

function EditExercisePage({ exercise }: { exercise?: Exercise }) {
  const authorNameOrUsername = exercise?.user?.name || exercise?.user?.username;
  const exerciseChapter = exercise?.type;

  return exercise ? (
    <>
      <SEOTags
        title={`Exercițiu ${exerciseChapter.toUpperCase()} | FrontEnd.ro`}
        description={`${authorNameOrUsername} a scris un exercițiu pentru ${exerciseChapter.toUpperCase()}.`}
        bigShareImage={false}
        shareImage={exercise.user.avatar}
        url={`https://FrontEnd.ro/exercitii/${exercise._id}`}
      />
      <>
        <Header />
        <ViewOrEditExercise exercise={exercise} />
        <Footer />
      </>
    </>

  ) : <NotFoundPage />;
}

export default EditExercisePage;

export async function getServerSideProps({ req, res, params }) {
  const { token } = req.cookies;
  const { exerciseId } = params;
  const { default: fetch } = await import('node-fetch');

  try {
    const resp = await fetch(`${process.env.ENDPOINT}/exercises/${exerciseId}`, {
      headers: {
        cookie: `token=${token}`,
      },
    });
    if (!resp.ok) {
      res.statusCode = resp.status;
      return {
        props: {
          exercise: null,
        },
      };
    }

    const exercise = await resp.json();
    return {
      props: { exercise, },
    };
  } catch (err) {
    console.error('[exerciseId.tsx][getServerSideProps]', err);
    return send404();
  }

  function send404() {
    res.statusCode = 404;

    return {
      props: {},
    };
  }
}
