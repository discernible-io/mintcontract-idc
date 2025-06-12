import "regenerator-runtime/runtime";
import React, { useState, useEffect } from "react";
import RODITForm from "./components/Form";
import SignIn from "./components/SignIn";
import { RODITset } from "./components/RODITset";

const App = ({ isSignedIn, roditForge, wallet }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [tx, setTx] = useState("");
  const [data, setData] = useState({
    openapijsonurl: "",
    startingDate: "",
    base58spprivateKey: "",
    accountId: "",
  });

  useEffect(() => {
    window.localStorage.setItem("isMinted", JSON.stringify(isMinted));
  }, [isMinted]);

  useEffect(() => {
    const data = window.localStorage.getItem("isMinted");
    if (data !== null) {
      setIsMinted(JSON.parse(data));
    }
  }, []);

  const nextstep = (enteredData, final = false) => {
    setData((prevState) => ({ ...prevState, ...enteredData }));

    if (final) {
      sendforMinting(enteredData);

      return;
    }

    setCurrentStep((prevState) => prevState + 1);
  };

  const prevstep = (enteredData) => {
    setData((prevState) => ({ ...prevState, ...enteredData }));

    setCurrentStep((prevState) => prevState - 1);
  };

  useEffect(() => {
    const text = window.location.search;

    if (text.includes("transaction")) {
      const url = text.split("=");
      const txUrl = url[1];
      // setTx(`https://nearblocks.io/txns/${txUrl}`);
      setTx(`https://explorer.testnet.near.org/transactions/${txUrl}`);
    }
  }, []);

  const sendforMinting = async (formData) => {
    const mint = await roditForge.buildpairofrodits(
      formData.openapijsonurl,
      formData.startingDate,
      formData.subjectuniqueidentifierUrl,
      formData.base58spprivateKey,
      formData.accountId
    );

    setIsMinted(true);
  };

  const signIn = () => {
    wallet.signIn();
  };

  const signOut = () => {
    wallet.signOut();
  };

  return (
    <main
      className={`${
        isSignedIn
          ? "overflow-hidden   bg-cameras h-screen bg-cover bg-center bg-no-repeat"
          : ""
      } `}
    >
      <div id="bg" className="backdrop-blur-md h-full w-full">
        <div>
          <div
            className={` flex justify-end mx-4 ${isSignedIn ? "pt-2" : ""} `}
          >
            <div id="wallet" className="">
              {isSignedIn && (
                <div
                  className="group relative inline-block rounded-xl bg-indigo-700 px-4 py-3 text-white cursor-pointer"
                  onClick={signOut}
                >
                  <span className=" font-medium transition-opacity group-hover:opacity-0">
                    {wallet.accountId.toString()}
                  </span>

                  <ul className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <li>
                      <a className="block rounded-full transition-opacity hover:opacity-90 focus:opacity-75 focus:outline-none">
                        <span className=" tracking-wider">Disconnect</span>
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          id="content"
          className={`${
            isSignedIn || isMinted ? "flex items-center justify-center" : ""
          } `}
        >
          {tx !== "" ? (
            ""
          ) : isSignedIn ? (
            <RODITForm
              data={data}
              step={currentStep}
              setCurrentStep={setCurrentStep}
              next={nextstep}
              prev={prevstep}
              setIsModalOpen={setIsModalOpen}
              isModal={isModalOpen}
              mint={sendforMinting}
            />
          ) : (
            <SignIn sign={signIn} />
          )}

          {tx !== "" && <RODITset tx={tx} />}
        </div>
      </div>
    </main>
  );
};
export default App;